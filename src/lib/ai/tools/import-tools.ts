import 'server-only';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import type { CopilotTool } from '../types';

export interface PlannedRow {
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  fabric: string;
  fit: string;
  price: string;
  compare_at_price: string;
  status: string;
  categories: string;
  featured: string;
  new_arrival: string;
  best_seller: string;
  images: string;
  variants: string;
}

interface PlanInput {
  name?: unknown;
  priceRupees?: unknown;
  compareAtRupees?: unknown;
  sizes?: unknown;
  color?: unknown;
  category?: unknown;
  stock?: unknown;
  images?: unknown;
  description?: unknown;
  fabric?: unknown;
  fit?: unknown;
}

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

/**
 * Turns "add a black shirt at 999, sizes S-XL, stock 20" into the exact rows
 * the existing bulk importer already knows how to create.
 *
 * Deliberately writes nothing. It resolves what the admin said against the
 * real sizes, colours and categories in the database and hands back a table
 * for them to check — the importer, which has all the per-row validation and
 * transactional creation, does the actual work once they confirm. That keeps
 * one product-creation path rather than giving the model a second one.
 *
 * Image filenames come from the attached ZIP and are matched by name: the
 * model cannot see photographs, so a file is only ever attached to a product
 * whose name the filename plainly refers to.
 */
export const importTools: CopilotTool[] = [
  {
    name: 'plan_product_import',
    description:
      'Prepare products for creation from a description, e.g. "add a Black shirt at 999 and a Beige shirt at 1299, sizes S M L XL, stock 20, category Shirts". Returns a table for the admin to confirm; it does NOT create anything. If the admin attached a ZIP, its filenames are listed in the conversation — assign each to the product its name refers to (black-shirt-front.jpg belongs to the Black shirt). Call this once with every product the admin listed.',
    permission: 'products.write',
    parameters: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          description: 'Every product the admin asked for.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Product name as the admin said it, e.g. "Black Shirt".' },
              priceRupees: { type: 'number', description: 'Selling price in rupees.' },
              compareAtRupees: { type: 'number', description: 'Optional struck-through original price.' },
              sizes: { type: 'array', items: { type: 'string' }, description: 'Size codes, e.g. ["S","M","L","XL"].' },
              color: { type: 'string', description: 'Colour name, e.g. "Black".' },
              category: { type: 'string', description: 'Category name or slug, e.g. "Shirts".' },
              stock: { type: 'number', description: 'Units per size.' },
              images: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filenames from the attached ZIP belonging to this product.',
              },
              description: { type: 'string' },
              fabric: { type: 'string' },
              fit: { type: 'string' },
            },
            required: ['name', 'priceRupees', 'sizes', 'color', 'stock'],
          },
        },
      },
      required: ['products'],
    },
    run: async (args) => {
      const products = Array.isArray(args.products) ? (args.products as PlanInput[]) : [];
      if (products.length === 0) return { ok: false, message: 'No products were described.' };

      const [sizes, colors, categories] = await Promise.all([
        prisma.size.findMany({ select: { code: true } }),
        prisma.color.findMany({ select: { slug: true, name: true } }),
        prisma.category.findMany({ where: { deletedAt: null }, select: { slug: true, name: true } }),
      ]);
      const sizeCodes = new Set(sizes.map((s) => s.code.toUpperCase()));
      const colorBySlug = new Map(colors.map((c) => [c.slug, c]));
      const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

      const rows: PlannedRow[] = [];
      const problems: string[] = [];

      for (const p of products) {
        const name = String(p.name ?? '').trim();
        if (!name) { problems.push('A product was described without a name.'); continue; }

        const price = Number(p.priceRupees);
        if (!Number.isFinite(price) || price <= 0) { problems.push(`${name}: price is missing or not a number.`); continue; }

        const colorSlug = slugify(String(p.color ?? ''));
        if (!colorBySlug.has(colorSlug)) {
          problems.push(`${name}: colour "${p.color}" is not set up in the store. Add it first, or use one of: ${colors.map((c) => c.name).join(', ')}.`);
          continue;
        }

        const wanted = asArray(p.sizes).map((s) => s.toUpperCase());
        const unknownSizes = wanted.filter((s) => !sizeCodes.has(s));
        if (wanted.length === 0) { problems.push(`${name}: no sizes given.`); continue; }
        if (unknownSizes.length) {
          problems.push(`${name}: unknown size${unknownSizes.length > 1 ? 's' : ''} ${unknownSizes.join(', ')}. Known sizes: ${[...sizeCodes].join(', ')}.`);
          continue;
        }

        // A category is optional, but a name that matches nothing is a typo
        // worth surfacing rather than quietly dropping.
        let categorySlug = '';
        if (p.category) {
          const slug = slugify(String(p.category));
          const match = categoryBySlug.get(slug) ?? categories.find((c) => slugify(c.name) === slug);
          if (!match) {
            problems.push(`${name}: category "${p.category}" does not exist. Known categories: ${categories.map((c) => c.name).join(', ')}.`);
            continue;
          }
          categorySlug = match.slug;
        }

        const stock = Math.max(0, Math.round(Number(p.stock ?? 0)));
        const slug = slugify(name);
        const clash = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
        if (clash) { problems.push(`${name}: a product with the address /product/${slug} already exists.`); continue; }

        const compareAt = Number(p.compareAtRupees);

        rows.push({
          name,
          slug,
          subtitle: '',
          description: String(p.description ?? '').trim(),
          fabric: String(p.fabric ?? '').trim(),
          fit: String(p.fit ?? '').trim(),
          price: String(price),
          compare_at_price: Number.isFinite(compareAt) && compareAt > price ? String(compareAt) : '',
          // Created as drafts on purpose: nothing the model prepared goes on
          // sale until a human has looked at it in Admin → Products.
          status: 'draft',
          categories: categorySlug,
          featured: 'false',
          new_arrival: 'false',
          best_seller: 'false',
          images: asArray(p.images).join(','),
          variants: wanted.map((s) => `${s}:${colorSlug}:${stock}`).join(';'),
        });
      }

      return {
        ok: rows.length > 0,
        plan: rows,
        problems,
        message:
          rows.length > 0
            ? `Prepared ${rows.length} product${rows.length === 1 ? '' : 's'} for the admin to confirm. They are NOT created yet.`
            : 'Nothing could be prepared.',
      };
    },
  },
];
