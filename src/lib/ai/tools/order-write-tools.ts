import 'server-only';
import { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notFound } from '@/lib/errors';
import { OrderService } from '@/services/order.service';
import type { CopilotTool } from '../types';

export const orderWriteTools: CopilotTool[] = [
  {
    name: 'update_order_status',
    description:
      'Change an order\'s status by its order number — e.g. mark it SHIPPED, DELIVERED, CANCELLED. Applies the same stock consequences (like restocking on a return) as the admin order page. Always confirmed first.',
    permission: 'orders.write',
    risk: 'write-low',
    parameters: {
      type: 'object',
      properties: {
        orderNumber: { type: 'string' },
        status: { type: 'string', enum: Object.values(OrderStatus) },
        message: { type: 'string', description: 'Optional note to attach to the status-change event.' },
      },
      required: ['orderNumber', 'status'],
    },
    confirmationSummary: (args) => `Change order ${String(args.orderNumber).toUpperCase()} to status ${args.status}.`,
    run: async (args, actor) => {
      const orderNumber = String(args.orderNumber).toUpperCase();
      const order = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
      if (!order) throw notFound(`No order found with number ${orderNumber}.`);

      await OrderService.updateStatus(order.id, args.status as OrderStatus, actor.id, args.message as string | undefined);
      return { updated: true, orderNumber, status: args.status };
    },
  },
];
