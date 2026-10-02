import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandling } from '@/lib/errors';
import { requireStaff } from '@/lib/auth/session';
import { runCopilot } from '@/lib/ai/copilot';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        text: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const actor = await requireStaff();

  if (!env().AI_API_KEY) {
    return NextResponse.json(
      { error: 'The AI Assistant is not configured yet — no API key is set on the server.' },
      { status: 503 },
    );
  }

  const { messages } = chatSchema.parse(await req.json());
  const lastMessage = messages[messages.length - 1];

  const reply = await runCopilot(messages, { id: actor.id, role: actor.role });

  const toPersist: { actorId: string; role: string; text: string }[] = [];
  if (lastMessage.role === 'user') {
    toPersist.push({ actorId: actor.id, role: 'user', text: lastMessage.text });
  }
  if (reply.text) {
    toPersist.push({ actorId: actor.id, role: 'model', text: reply.text });
  } else if (reply.pendingAction) {
    toPersist.push({ actorId: actor.id, role: 'model', text: `Proposed: ${reply.pendingAction.summary}` });
  }
  if (toPersist.length) {
    await prisma.aiChatMessage.createMany({ data: toPersist }).catch((err) => console.error('[ai-chat] history save failed', err));
  }

  // A prepared import is handed to the UI in full: it is a table the admin
  // has to check and confirm, not something the model may act on itself.
  const planCall = reply.toolCalls.find((c) => c.name === 'plan_product_import' && c.ok);
  const plan = planCall?.result as { plan?: unknown[]; problems?: string[] } | undefined;

  return NextResponse.json({
    text: reply.text,
    toolCalls: reply.toolCalls.map((c) => ({ name: c.name, ok: c.ok })),
    pendingAction: reply.pendingAction,
    productPlan: plan?.plan?.length ? { rows: plan.plan, problems: plan.problems ?? [] } : undefined,
  });
});
