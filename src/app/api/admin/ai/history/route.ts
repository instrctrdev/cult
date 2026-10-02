import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { requireStaff } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** This admin's own chat history only — never shared across staff accounts. */
export const GET = withErrorHandling(async () => {
  const actor = await requireStaff();

  const messages = await prisma.aiChatMessage.findMany({
    where: { actorId: actor.id },
    orderBy: { createdAt: 'asc' },
    take: 300,
    select: { role: true, text: true, createdAt: true },
  });

  return NextResponse.json({
    messages: messages.map((m) => ({ role: m.role, text: m.text, createdAt: m.createdAt.toISOString() })),
  });
});
