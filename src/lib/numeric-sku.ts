import 'server-only';
import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/prisma';

/** Generates a scanner-friendly 12 digit SKU and verifies it is unused. */
export async function generateNumericSku(reserved = new Set<string>()): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = String(randomInt(100_000_000_000, 1_000_000_000_000));
    if (reserved.has(candidate)) continue;
    const existing = await prisma.productVariant.findUnique({ where: { sku: candidate }, select: { id: true } });
    if (!existing) {
      reserved.add(candidate);
      return candidate;
    }
  }
  throw new Error('Could not generate a unique numeric SKU. Please try again.');
}
