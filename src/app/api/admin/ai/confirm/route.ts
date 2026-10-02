import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandling, forbidden, notFound } from '@/lib/errors';
import { requireStaff } from '@/lib/auth/session';
import { can } from '@/lib/auth/rbac';
import { TOOLS_BY_NAME } from '@/lib/ai/tools';
import { AuditService } from '@/services/audit.service';
import { clientIp } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const confirmSchema = z.object({
  name: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
  cancelled: z.boolean().optional(),
});

/**
 * The only place a write tool actually executes. The chat route (`/api/admin/ai/chat`)
 * never calls `tool.run` for a write-risk tool — it hands the model's proposed
 * call back to the UI as a confirmation card, and only a POST here, after the
 * admin explicitly confirms, runs it for real. `cancelled: true` skips
 * execution entirely and just records that the admin declined it, so chat
 * history reflects the real outcome instead of a forever-"Proposed" line.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const actor = await requireStaff();
  const { name, args, cancelled } = confirmSchema.parse(await req.json());

  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) throw notFound(`No such tool: ${name}`);
  if (!can(actor.role, tool.permission)) throw forbidden(`Your role does not allow: ${tool.permission}`);
  if ((tool.risk ?? 'read') === 'read') throw forbidden('This tool does not require confirmation.');

  const summary = tool.confirmationSummary?.(args) ?? `Ran ${name}.`;

  if (cancelled) {
    await prisma.aiChatMessage
      .create({ data: { actorId: actor.id, role: 'model', text: `Cancelled: ${summary}` } })
      .catch((err) => console.error('[ai-confirm] history save failed', err));
    return NextResponse.json({ ok: true, cancelled: true, summary });
  }

  try {
    const result = await tool.run(args, { id: actor.id, role: actor.role });

    const domain = tool.permission.split('.')[0];
    await AuditService.log({
      actorId: actor.id,
      action: `ai.${name}`,
      entityType: domain.charAt(0).toUpperCase() + domain.slice(1),
      changes: { after: args, result },
      ip: clientIp(req.headers),
    });

    await prisma.aiChatMessage
      .create({ data: { actorId: actor.id, role: 'model', text: `Done — ${summary}` } })
      .catch((err) => console.error('[ai-confirm] history save failed', err));

    return NextResponse.json({ ok: true, summary, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The action failed unexpectedly.';

    await prisma.aiChatMessage
      .create({ data: { actorId: actor.id, role: 'model', text: `Couldn't do it — ${summary} — ${message}` } })
      .catch((e) => console.error('[ai-confirm] history save failed', e));

    return NextResponse.json({ ok: false, summary, error: message }, { status: 200 });
  }
});
