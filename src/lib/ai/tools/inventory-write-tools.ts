import 'server-only';
import { prisma } from '@/lib/prisma';
import { notFound } from '@/lib/errors';
import { InventoryService } from '@/services/inventory.service';
import type { CopilotTool } from '../types';

export const inventoryWriteTools: CopilotTool[] = [
  {
    name: 'adjust_inventory',
    description:
      'Set a variant\'s on-hand stock to an exact quantity, by its SKU (from search_products / get_product). Use for "set stock of ABC-S-BLACK to 50", "restock this to 20". Always confirmed first.',
    permission: 'inventory.write',
    risk: 'write-low',
    parameters: {
      type: 'object',
      properties: {
        sku: { type: 'string' },
        quantity: { type: 'number', description: 'The new absolute on-hand quantity, not a delta.' },
        note: { type: 'string' },
      },
      required: ['sku', 'quantity'],
    },
    confirmationSummary: (args) => `Set stock of ${args.sku} to ${args.quantity} units.`,
    run: async (args, actor) => {
      const sku = String(args.sku).toUpperCase();
      const variant = await prisma.productVariant.findUnique({ where: { sku }, select: { id: true } });
      if (!variant) throw notFound(`No variant with SKU ${sku}.`);

      const quantity = Math.max(0, Math.round(Number(args.quantity)));
      await InventoryService.adjust(variant.id, quantity, actor.id, args.note as string | undefined);
      return { updated: true, sku, quantity };
    },
  },
];
