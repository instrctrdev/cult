import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { requireUser } from '@/lib/auth/session';
import { CustomerService } from '@/services/customer.service';
import { addressSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  return NextResponse.json({ addresses: await CustomerService.listAddresses(user.id) });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await requireUser();
  const body = addressSchema.parse(await req.json());
  const address = await CustomerService.addAddress(user.id, {
    ...body,
    line2: body.line2 || null,
    landmark: body.landmark || null,
  });
  return NextResponse.json(address, { status: 201 });
});
