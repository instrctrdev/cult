import 'server-only';
import { prisma } from '@/lib/prisma';
import { toPaise, formatPaise } from '@/lib/money';
import type { CopilotTool } from '../types';

export const couponTools: CopilotTool[] = [
  {
    name: 'list_coupons',
    description: 'List coupons, optionally filtered to only active (not expired, not disabled) ones.',
    permission: 'coupons.read',
    parameters: {
      type: 'object',
      properties: {
        activeOnly: { type: 'boolean', description: 'Only coupons currently usable — active and not past their expiry date.' },
      },
    },
    run: async (args) => {
      const now = new Date();
      const coupons = await prisma.coupon.findMany({
        where: {
          deletedAt: null,
          ...(args.activeOnly ? { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });

      return {
        count: coupons.length,
        coupons: coupons.map((c) => ({
          code: c.code,
          type: c.type,
          value: c.type === 'PERCENTAGE' ? `${c.value}%` : formatPaise(toPaise(c.value)),
          minOrderAmount: c.minOrderAmount ? formatPaise(toPaise(c.minOrderAmount)) : null,
          isActive: c.isActive,
          usedCount: c.usedCount,
          usageLimit: c.usageLimit,
          expiresAt: c.expiresAt?.toISOString() ?? null,
        })),
      };
    },
  },
];
