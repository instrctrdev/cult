import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { requireUser } from '@/lib/auth/session';
import { CustomerService } from '@/services/customer.service';
import { addressSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = addressSchema.partial().parse(await req.json());
  // Ownership is enforced inside the service, not by the route.
  const updated = await CustomerService.updateAddress(user.id, id, body);
  return NextResponse.json(updated);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await CustomerService.deleteAddress(user.id, id);
  return NextResponse.json({ ok: true });
});
