import { NextResponse, type NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/session';
import { withErrorHandling } from '@/lib/errors';
import { createOfflineSale, offlineSaleInput } from '@/services/offline-sale.service';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (req: NextRequest) => {
  const actor = await requirePermission('orders.write');
  const input = offlineSaleInput.parse(await req.json());
  const sale = await createOfflineSale(input, actor.id);
  return NextResponse.json({ id: sale.id, receiptNumber: sale.receiptNumber });
});
