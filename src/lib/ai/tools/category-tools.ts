import 'server-only';
import { prisma } from '@/lib/prisma';
import type { CopilotTool } from '../types';

export const categoryTools: CopilotTool[] = [
  {
    name: 'get_categories',
    description: 'List every category with how many products are in it. Use for "show all categories", "how many products in Shirts".',
    permission: 'categories.read',
    parameters: { type: 'object', properties: {} },
    run: async () => {
      const categories = await prisma.category.findMany({
        where: { deletedAt: null },
        orderBy: { position: 'asc' },
        select: {
          slug: true, name: true, isActive: true,
          _count: { select: { products: true } },
        },
      });
      return {
        categories: categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          active: c.isActive,
          productCount: c._count.products,
        })),
      };
    },
  },
];
