import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/session';
import { withErrorHandling } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  messages: z.array(z.string().trim().min(1).max(255)).min(1).max(20),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requirePermission('banners.write');
  const { messages } = schema.parse(await req.json());
  const current = await prisma.banner.aggregate({ where: { placement: 'ANNOUNCEMENT' }, _max: { position: true } });
  const firstPosition = (current._max.position ?? -1) + 1;
  const created = await prisma.banner.createMany({
    data: messages.map((title, index) => ({
      title,
      placement: 'ANNOUNCEMENT',
      position: firstPosition + index,
      isActive: true,
    })),
  });
  return NextResponse.json({ count: created.count }, { status: 201 });
});
