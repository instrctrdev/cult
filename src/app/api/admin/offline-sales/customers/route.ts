import { NextResponse, type NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/session';
import { withErrorHandling, badRequest } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requirePermission('orders.write');
  const digits = (req.nextUrl.searchParams.get('phone') ?? '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '');
  if (!/^\d{4,10}$/.test(digits)) throw badRequest('Enter at least four phone digits.');
  const sales = await prisma.offlineSale.findMany({
    where: { customerPhone: { startsWith: digits }, customerName: { not: null, notIn: [''] } },
    orderBy: { createdAt: 'desc' }, distinct: ['customerPhone'], take: 8,
    select: { customerPhone: true, customerName: true },
  });
  const customers = sales.flatMap((sale) => sale.customerPhone && sale.customerName?.trim()
    ? [{ phone: sale.customerPhone, name: sale.customerName }] : []);
  if (digits.length === 10 && !customers.some((customer) => customer.phone === digits)) {
    const user = await prisma.user.findFirst({
      where: { phone: { in: [digits, `+91${digits}`, `91${digits}`] }, role: 'CUSTOMER', deletedAt: null },
      select: { firstName: true, lastName: true },
    });
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
    if (name) customers.unshift({ phone: digits, name });
  }
  return NextResponse.json({ customers }, { headers: { 'Cache-Control': 'private, no-store' } });
});
