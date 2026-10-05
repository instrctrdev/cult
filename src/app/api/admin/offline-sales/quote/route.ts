import { NextResponse, type NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/session';
import { withErrorHandling } from '@/lib/errors';
import { offlineSaleInput, quoteOfflineSale } from '@/services/offline-sale.service';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requirePermission('orders.write');
  const input = offlineSaleInput.parse(await req.json());
  return NextResponse.json(await quoteOfflineSale(input));
});
