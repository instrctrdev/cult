import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling, badRequest } from '@/lib/errors';
import { resetPasswordSchema } from '@/lib/validation';
import { CustomerService } from '@/services/customer.service';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (req: NextRequest) => {
  enforceRateLimit({ key: 'reset', identifier: clientIp(req.headers), limit: 10, windowSeconds: 3600 });

  const body = resetPasswordSchema.parse(await req.json());
  const ok = await CustomerService.resetPassword(body.token, body.password);
  if (!ok) throw badRequest('That reset link is invalid or has expired. Please request a new one.');

  return NextResponse.json({ ok: true });
});
