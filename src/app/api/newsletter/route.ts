import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { newsletterSchema } from '@/lib/validation';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (req: NextRequest) => {
  enforceRateLimit({ key: 'newsletter', identifier: clientIp(req.headers), limit: 5, windowSeconds: 3600 });

  const { email, source } = newsletterSchema.parse(await req.json());

  // Upsert keeps re-subscribing idempotent and silently re-activates opt-outs.
  await prisma.newsletterSubscriber.upsert({
    where: { email },
    create: { email, source: source ?? null },
    update: { isActive: true },
  });

  return NextResponse.json({ ok: true });
});
