import type { Prisma } from '@prisma/client';

export type OfflineSaleSearch = { page?: string; q?: string; period?: string; from?: string; to?: string; payment?: string; cashier?: string };

function dateAtIndiaMidnight(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const day = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value) return undefined;
  return new Date(`${value}T00:00:00+05:30`);
}

export function offlineSaleFilters(search: OfflineSaleSearch, now = new Date()) {
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const period = ['today', 'week', 'month', 'custom'].includes(search.period ?? '') ? search.period! : 'all';
  const start = dateAtIndiaMidnight(today)!;
  let from = dateAtIndiaMidnight(search.from);
  let to = dateAtIndiaMidnight(search.to);
  let error = '';
  if (period === 'custom') {
    if ((search.from && !from) || (search.to && !to)) error = 'Enter valid dates.';
    if (from && to && from > to) error = 'From date must be on or before To date.';
  } else {
    from = period === 'today' ? start : period === 'week' ? new Date(start.getTime() - 6 * 86400000)
      : period === 'month' ? dateAtIndiaMidnight(`${today.slice(0, 7)}-01`) : undefined;
    to = period === 'all' ? undefined : start;
  }
  const query = search.q?.trim().slice(0, 150);
  const where: Prisma.OfflineSaleWhereInput = {
    ...(error ? { id: '__invalid_date_filter__' } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 86400000) } : {}) } } : {}),
    ...(search.payment === 'CASH' || search.payment === 'CARD' ? { paymentMethod: search.payment } : {}),
    ...(search.cashier ? { cashierId: search.cashier } : {}),
    ...(query ? { OR: [{ receiptNumber: { contains: query } }, { customerName: { contains: query } }, { customerPhone: { contains: query } }] } : {}),
  };
  return { where, period, today, error };
}
