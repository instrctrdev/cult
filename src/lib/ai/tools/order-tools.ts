import 'server-only';
import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { toPaise, formatPaise } from '@/lib/money';
import type { CopilotTool } from '../types';

/** Read-only order lookups. Mirrors the exact filter shape Admin → Orders itself uses. */
export const orderTools: CopilotTool[] = [
  {
    name: 'get_orders',
    description:
      'List recent orders, optionally filtered by status, payment method, a minimum total, or a date range. Use this for "show today\'s orders", "show pending orders", "COD orders", "orders above Rs. 2000", etc.',
    permission: 'orders.read',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: Object.values(OrderStatus), description: 'Order status to filter by.' },
        paymentMethod: { type: 'string', enum: Object.values(PaymentMethod) },
        minTotalRupees: { type: 'number', description: 'Only orders with a grand total at or above this many rupees.' },
        sinceDate: { type: 'string', description: 'ISO date (YYYY-MM-DD) — only orders placed on or after this date. Use today\'s date for "today\'s orders".' },
        limit: { type: 'number', description: 'Max rows to return, default 20, max 50.' },
      },
    },
    run: async (args) => {
      const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
      const where: Prisma.OrderWhereInput = {
        ...(args.status ? { status: args.status as OrderStatus } : {}),
        ...(args.paymentMethod ? { paymentMethod: args.paymentMethod as PaymentMethod } : {}),
        ...(typeof args.minTotalRupees === 'number' ? { grandTotal: { gte: args.minTotalRupees } } : {}),
        ...(typeof args.sinceDate === 'string' && args.sinceDate
          ? { placedAt: { gte: new Date(`${args.sinceDate}T00:00:00`) } }
          : {}),
      };

      const orders = await prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        take: limit,
        select: {
          orderNumber: true, status: true, grandTotal: true, placedAt: true,
          email: true, paymentMethod: true,
          payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
        },
      });

      return {
        count: orders.length,
        orders: orders.map((o) => ({
          orderNumber: o.orderNumber,
          status: o.status,
          total: formatPaise(toPaise(o.grandTotal)),
          placedAt: o.placedAt.toISOString(),
          email: o.email,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.payments[0]?.status ?? null,
        })),
      };
    },
  },
  {
    name: 'get_order',
    description: 'Get full detail for one order by its order number (e.g. CU-2026-0042).',
    permission: 'orders.read',
    parameters: {
      type: 'object',
      properties: { orderNumber: { type: 'string' } },
      required: ['orderNumber'],
    },
    run: async (args) => {
      const orderNumber = String(args.orderNumber).toUpperCase();
      const order = await prisma.order.findUnique({
        where: { orderNumber },
        select: {
          orderNumber: true, status: true, grandTotal: true, placedAt: true,
          email: true, phone: true, paymentMethod: true, couponCode: true,
          items: { select: { productName: true, variantLabel: true, quantity: true, lineTotal: true } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, provider: true } },
        },
      });
      if (!order) return { found: false, message: `No order found with number ${orderNumber}.` };

      return {
        found: true,
        orderNumber: order.orderNumber,
        status: order.status,
        total: formatPaise(toPaise(order.grandTotal)),
        placedAt: order.placedAt.toISOString(),
        customerEmail: order.email,
        customerPhone: order.phone,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.payments[0]?.status ?? null,
        couponCode: order.couponCode,
        items: order.items.map((i) => ({
          product: i.productName,
          variant: i.variantLabel,
          quantity: i.quantity,
          lineTotal: formatPaise(toPaise(i.lineTotal)),
        })),
      };
    },
  },
  {
    name: 'get_order_summary',
    description:
      'Order counts and revenue for a date range — use for "how many orders today", "today\'s revenue", "this week\'s orders". Defaults to today if no dates given.',
    permission: 'orders.read',
    parameters: {
      type: 'object',
      properties: {
        sinceDate: { type: 'string', description: 'ISO date YYYY-MM-DD, inclusive start. Defaults to today.' },
        untilDate: { type: 'string', description: 'ISO date YYYY-MM-DD, inclusive end. Defaults to today.' },
      },
    },
    run: async (args) => {
      const today = new Date().toISOString().slice(0, 10);
      const since = new Date(`${(args.sinceDate as string) || today}T00:00:00`);
      const until = new Date(`${(args.untilDate as string) || today}T23:59:59.999`);

      const [count, revenueAgg, byStatus] = await Promise.all([
        prisma.order.count({ where: { placedAt: { gte: since, lte: until } } }),
        prisma.order.aggregate({
          where: { placedAt: { gte: since, lte: until }, status: { notIn: [OrderStatus.CANCELLED] } },
          _sum: { grandTotal: true },
        }),
        prisma.order.groupBy({
          by: ['status'],
          where: { placedAt: { gte: since, lte: until } },
          _count: { status: true },
        }),
      ]);

      return {
        range: { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) },
        orderCount: count,
        revenue: formatPaise(toPaise(revenueAgg._sum.grandTotal ?? 0)),
        byStatus: Object.fromEntries(byStatus.map((b) => [b.status, b._count.status])),
      };
    },
  },
];
