import 'server-only';
import { Prisma, ProductStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { toPaise, formatPaise } from '@/lib/money';
import type { CopilotTool } from '../types';

/**
 * Admin-scoped search — deliberately not the storefront's `ProductService`,
 * which only ever returns published, in-stock products. An admin asking
 * "show me black shirts" needs drafts and out-of-stock ones to show up too.
 */
export const productTools: CopilotTool[] = [
  {
    name: 'search_products',
    description:
      'Search products by name, category slug, colour, or status (draft/active/archived). Use for "show me black shirts", "which products are drafts", etc.',
    permission: 'products.read',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Text to search in the product name.' },
        category: { type: 'string', description: 'Category slug, e.g. "shirts".' },
        color: { type: 'string', description: 'Colour slug, e.g. "black".' },
        status: { type: 'string', enum: Object.values(ProductStatus) },
        limit: { type: 'number', description: 'Max rows, default 15, max 40.' },
      },
    },
    run: async (args) => {
      const limit = Math.min(40, Math.max(1, Number(args.limit) || 15));
      const where: Prisma.ProductWhereInput = {
        deletedAt: null,
        ...(args.name ? { name: { contains: String(args.name) } } : {}),
        ...(args.status ? { status: args.status as ProductStatus } : {}),
        ...(args.category ? { categories: { some: { category: { slug: String(args.category) } } } } : {}),
        ...(args.color
          ? { variants: { some: { deletedAt: null, color: { slug: String(args.color) } } } }
          : {}),
      };

      const products = await prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          slug: true, name: true, status: true, price: true, compareAtPrice: true,
          needsImagery: true, needsDescription: true,
          variants: { where: { deletedAt: null }, select: { inventory: { select: { quantity: true, reserved: true } } } },
        },
      });

      return {
        count: products.length,
        products: products.map((p) => ({
          slug: p.slug,
          name: p.name,
          status: p.status,
          price: formatPaise(toPaise(p.price)),
          onSale: p.compareAtPrice != null,
          totalStock: p.variants.reduce((sum, v) => sum + Math.max(0, (v.inventory?.quantity ?? 0) - (v.inventory?.reserved ?? 0)), 0),
          needsAttention: p.needsImagery || p.needsDescription,
        })),
      };
    },
  },
  {
    name: 'get_product',
    description: 'Full detail for one product by its URL slug, including every variant and stock level.',
    permission: 'products.read',
    parameters: {
      type: 'object',
      properties: { slug: { type: 'string' } },
      required: ['slug'],
    },
    run: async (args) => {
      const product = await prisma.product.findFirst({
        where: { slug: String(args.slug), deletedAt: null },
        select: {
          slug: true, name: true, status: true, price: true, compareAtPrice: true, fabric: true, fit: true,
          categories: { select: { category: { select: { name: true } } } },
          variants: {
            where: { deletedAt: null },
            select: {
              sku: true, size: { select: { label: true } }, color: { select: { name: true } },
              price: true, inventory: { select: { quantity: true, reserved: true } },
            },
          },
        },
      });
      if (!product) return { found: false, message: `No product found with slug "${args.slug}".` };

      return {
        found: true,
        name: product.name,
        slug: product.slug,
        status: product.status,
        price: formatPaise(toPaise(product.price)),
        fabric: product.fabric,
        fit: product.fit,
        categories: product.categories.map((c) => c.category.name),
        variants: product.variants.map((v) => ({
          sku: v.sku,
          size: v.size?.label ?? null,
          color: v.color?.name ?? null,
          price: formatPaise(toPaise(v.price)),
          available: Math.max(0, (v.inventory?.quantity ?? 0) - (v.inventory?.reserved ?? 0)),
        })),
      };
    },
  },
];
