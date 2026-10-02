import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Retired endpoint: all new checkouts must use Cashfree One Click Checkout. */
export async function POST() {
  return NextResponse.json(
    { error: { code: 'GONE', message: 'Start checkout from your bag using Cashfree.' } },
    { status: 410 },
  );
}
