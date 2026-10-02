import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/** Records who changed what in the admin panel. Failures never block the action. */
export const AuditService = {
  async log(input: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    changes?: unknown;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    await prisma.auditLog
      .create({
        data: {
          actorId: input.actorId,
          action: input.action.slice(0, 100),
          entityType: input.entityType.slice(0, 64),
          entityId: input.entityId?.slice(0, 191) ?? null,
          changes: (input.changes ?? undefined) as Prisma.InputJsonValue | undefined,
          ip: input.ip?.slice(0, 64) ?? null,
          userAgent: input.userAgent?.slice(0, 255) ?? null,
        },
      })
      .catch((err) => console.error('[audit] failed to record', err));
  },

  async list(params: { page?: number; perPage?: number; entityType?: string } = {}) {
    const page = Math.max(1, params.page ?? 1);
    const perPage = Math.min(100, params.perPage ?? 50);
    const where = params.entityType ? { entityType: params.entityType } : {};

    const [total, data] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { actor: { select: { email: true, firstName: true } } },
      }),
    ]);
    return { data, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
  },
};
