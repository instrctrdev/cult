import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { conflict, notFound } from '@/lib/errors';
import { adminCouponSchema } from '@/lib/validation';
import type { CopilotTool } from '../types';

/** Same shape and validation the Admin → Coupons form itself uses — no separate rules for the AI path. */
export const couponWriteTools: CopilotTool[] = [
  {
    name: 'create_coupon',
    description:
      'Create a new discount coupon. Use for "make a 20% off coupon", "create a code SAVE100 for Rs. 100 off orders above Rs. 999", etc. Always confirmed with the admin before it is actually created.',
    permission: 'coupons.write',
    risk: 'write-low',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Coupon code, e.g. "SAVE20". Will be uppercased.' },
        type: { type: 'string', enum: ['PERCENTAGE', 'FIXED'] },
        value: { type: 'number', description: 'Percentage (0-100) or a rupee amount, matching type.' },
        minOrderAmount: { type: 'number', description: 'Minimum order total in rupees required to use it.' },
        usageLimit: { type: 'number', description: 'Total number of times this code can ever be used.' },
        expiresAt: { type: 'string', description: 'ISO date (YYYY-MM-DD) after which the coupon stops working.' },
      },
      required: ['code', 'type', 'value'],
    },
    confirmationSummary: (args) => {
      const value = args.type === 'PERCENTAGE' ? `${args.value}%` : `Rs. ${args.value}`;
      const min = args.minOrderAmount ? ` on orders above Rs. ${args.minOrderAmount}` : '';
      const exp = args.expiresAt ? `, expiring ${args.expiresAt}` : '';
      return `Create coupon ${String(args.code).toUpperCase()} — ${value} off${min}${exp}.`;
    },
    run: async (args) => {
      const body = adminCouponSchema.parse({
        code: args.code,
        type: args.type,
        value: args.value,
        minOrderAmount: args.minOrderAmount ?? null,
        usageLimit: args.usageLimit ?? null,
        expiresAt: args.expiresAt ?? null,
        isActive: true,
        appliesToSubset: false,
        freeShipping: false,
        firstOrderOnly: false,
        productIds: [],
        categoryIds: [],
      });

      const clash = await prisma.coupon.findUnique({ where: { code: body.code }, select: { id: true } });
      if (clash) throw conflict('That coupon code already exists.');

      const coupon = await prisma.coupon.create({
        data: {
          code: body.code,
          type: body.type,
          value: new Prisma.Decimal(body.value),
          minOrderAmount: body.minOrderAmount ? new Prisma.Decimal(body.minOrderAmount) : null,
          usageLimit: body.usageLimit ?? null,
          expiresAt: body.expiresAt ?? null,
          isActive: true,
        },
      });

      return { created: true, code: coupon.code, id: coupon.id };
    },
  },
  {
    name: 'set_coupon_active',
    description: 'Activate or deactivate an existing coupon by its code — use for "disable code SAVE20", "turn WELCOME10 back on".',
    permission: 'coupons.write',
    risk: 'write-low',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        isActive: { type: 'boolean' },
      },
      required: ['code', 'isActive'],
    },
    confirmationSummary: (args) => `${args.isActive ? 'Activate' : 'Deactivate'} coupon ${String(args.code).toUpperCase()}.`,
    run: async (args) => {
      const code = String(args.code).toUpperCase();
      const coupon = await prisma.coupon.findUnique({ where: { code }, select: { id: true } });
      if (!coupon) throw notFound(`No coupon with code ${code}.`);
      await prisma.coupon.update({ where: { id: coupon.id }, data: { isActive: Boolean(args.isActive) } });
      return { updated: true, code, isActive: Boolean(args.isActive) };
    },
  },
];
