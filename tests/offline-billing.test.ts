import test from 'node:test';
import assert from 'node:assert/strict';
import { offlineDiscountPaise } from '../src/lib/offline-discount';
import { offlineSaleFilters } from '../src/lib/offline-sale-filters';

test('fixed and percentage discounts preserve paise and support full discounts', () => {
  assert.equal(offlineDiscountPaise(150000, 10, 0), 15000);
  assert.equal(offlineDiscountPaise(150000, 0, 25050), 25050);
  assert.equal(offlineDiscountPaise(99999, 12.5, 0), 12500);
  assert.equal(offlineDiscountPaise(150000, 100, 0), 150000);
  assert.equal(offlineDiscountPaise(150000, 0, 150000), 150000);
  assert.equal(offlineDiscountPaise(150000, 0, 0), 0);
});

test('discounts reject excessive, negative, non-finite and combined values', () => {
  for (const [subtotal, percent, fixed] of [[10000, 0, 10001], [10000, -1, 0], [10000, 101, 0], [10000, 5, 100], [10000, NaN, 0], [10000, 0, -1], [10000, 0, 0.5]]) {
    assert.throws(() => offlineDiscountPaise(subtotal, percent, fixed), RangeError);
  }
});

test('custom sales dates include the entire final day in India time', () => {
  const { where, error } = offlineSaleFilters({ period: 'custom', from: '2026-11-01', to: '2026-11-23', payment: 'CASH', cashier: 'cashier-1', q: ' GUNA ' });
  assert.equal(error, '');
  assert.deepEqual(where.createdAt, { gte: new Date('2026-10-31T18:30:00Z'), lt: new Date('2026-11-23T18:30:00Z') });
  assert.equal(where.paymentMethod, 'CASH');
  assert.equal(where.cashierId, 'cashier-1');
  assert.deepEqual(where.OR, [{ receiptNumber: { contains: 'GUNA' } }, { customerName: { contains: 'GUNA' } }, { customerPhone: { contains: 'GUNA' } }]);
});

test('quick periods use India midnight even across the UTC date boundary', () => {
  const now = new Date('2026-11-22T20:00:00Z');
  assert.deepEqual(offlineSaleFilters({ period: 'today' }, now).where.createdAt,
    { gte: new Date('2026-11-22T18:30:00Z'), lt: new Date('2026-11-23T18:30:00Z') });
  assert.deepEqual(offlineSaleFilters({ period: 'week' }, now).where.createdAt,
    { gte: new Date('2026-11-16T18:30:00Z'), lt: new Date('2026-11-23T18:30:00Z') });
  assert.equal(offlineSaleFilters({}, now).where.createdAt, undefined);
});

test('invalid or reversed dates never return misleading unfiltered sales', () => {
  for (const dates of [{ from: '2026-02-30' }, { from: '2026-11-24', to: '2026-11-23' }]) {
    const result = offlineSaleFilters({ period: 'custom', ...dates });
    assert.ok(result.error);
    assert.equal(result.where.id, '__invalid_date_filter__');
  }
});
