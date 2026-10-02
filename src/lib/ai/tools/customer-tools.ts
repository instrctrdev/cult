import 'server-only';
import { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { toPaise, formatPaise } from '@/lib/money';
import { CustomerService } from '@/services/customer.service';
import type { CopilotTool } from '../types';

/**
 * Read-only, and deliberately narrow — no address, no payment history,
 * nothing beyond what a store manager actually needs to answer "find
 * customer X" or "what has this customer spent".
 */
export const customerTools: CopilotTool[] = [
  {
    name: 'search_customers',
    description: 'Find customers by name, email, or phone. Use for "find customer Rahul", etc.',
    permission: 'customers.read',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    run: async (args) => {
      const { data } = await CustomerService.listCustomers({ search: String(args.query), perPage: 10 });
      return {
        count: data.length,
        customers: data.map((c) => ({
          id: c.id,
          name: [c.firstName, c.lastName].filter(Boolean).join(' ') || null,
          email: c.email,
          phone: c.phone,
          orderCount: c._count.orders,
        })),
      };
    },
  },
  {
    name: 'get_customer_summary',
    description: 'Order count and total lifetime spend for one customer, by their id (from search_customers).',
    permission: 'customers.read',
    parameters: {
      type: 'object',
      properties: { customerId: { type: 'string' } },
      required: ['customerId'],
    },
    run: async (args) => {
      const customerId = String(args.customerId);
      const [profile, agg] = await Promise.all([
        prisma.user.findUnique({ where: { id: customerId }, select: { email: true, firstName: true, lastName: true } }),
        prisma.order.aggregate({
          where: { userId: customerId, status: { notIn: [OrderStatus.CANCELLED] } },
          _sum: { grandTotal: true },
          _count: true,
        }),
      ]);
      if (!profile) return { found: false, message: 'No customer with that id.' };

      return {
        found: true,
        name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || null,
        email: profile.email,
        orderCount: agg._count,
        totalSpent: formatPaise(toPaise(agg._sum.grandTotal ?? 0)),
      };
    },
  },
];
