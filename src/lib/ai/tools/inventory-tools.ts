import 'server-only';
import { InventoryService } from '@/services/inventory.service';
import type { CopilotTool } from '../types';

export const inventoryTools: CopilotTool[] = [
  {
    name: 'get_low_stock_products',
    description:
      'Products whose available stock (quantity minus reserved) is at or below their configured low-stock threshold. Use for "which products are low in stock", "what\'s running low", "out of stock products" (filter the result to available = 0 for that case).',
    permission: 'inventory.read',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Max rows, default 20.' } },
    },
    run: async (args) => {
      const rows = await InventoryService.lowStock(Math.min(50, Math.max(1, Number(args.limit) || 20)));
      return {
        count: rows.length,
        items: rows.map((r) => ({
          product: r.variant.product.name,
          slug: r.variant.product.slug,
          sku: r.variant.sku,
          size: r.variant.size?.code ?? null,
          color: r.variant.color?.name ?? null,
          available: Math.max(0, r.quantity - r.reserved),
          threshold: r.lowStockThreshold,
        })),
      };
    },
  },
];
