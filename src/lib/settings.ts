import 'server-only';
import { cache } from 'react';
import { prisma } from './prisma';

/**
 * Commerce rules. The seeded defaults are changeable through the admin:
 *
 *   SHIP_FEE = 9900 paise            → ₹99 flat shipping
 *   Free shipping threshold = 99900 → free over ₹999
 *   "Handling ₹7 × items"            → ₹7 per unit
 *   "Prepaid: no extra | COD: +₹27"  → ₹27 COD surcharge
 *
 * Admin edits override these in the Setting table.
 */
export const SETTING_DEFAULTS = {
  'shipping.fee_paise': 9900,
  'shipping.free_threshold_paise': 59900,
  'shipping.free_enabled': true,
  /**
   * Free delivery on prepaid orders, with COD still paying the flat fee.
   *
   * A nudge away from cash: prepaid orders are money already in the account
   * and almost never come back as a refused delivery, so the fee is worth
   * waiving to move people onto it. The gateway applies the same rule on its
   * own side — this makes the store say so before checkout, which is where
   * the shopper decides.
   */
  'shipping.prepaid_free_enabled': false,
  'shipping.cod_enabled': true,
  'shipping.cod_fee_paise': 4900,
  'handling.per_item_paise': 700,
  'tax.enabled': false,
  'tax.rate_percent': 0,
  'orders.number_prefix': 'CT',
  'store.currency': 'INR',
  'store.email': '',
  'store.phone': '',
  'store.pickup_pincode': '530001',
  // ── Business identity, printed on invoices ──────────────────────────────
  // A tax invoice has to say who issued it. Blank fields are simply omitted
  // from the document rather than printed as empty labels.
  'store.legal_name': 'CULT Clothing',
  'store.address_line1': '',
  'store.address_line2': '',
  'store.city': '',
  'store.state': '',
  'store.pincode': '',
  'store.gstin': '',
  'inventory.low_stock_threshold': 3,

} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type SettingValue = (typeof SETTING_DEFAULTS)[SettingKey];

function parse(raw: string, sample: unknown): unknown {
  if (typeof sample === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : sample;
  }
  if (typeof sample === 'boolean') return raw === 'true' || raw === '1';
  return raw;
}

/**
 * Loads all settings once per request. Falls back to defaults if the table is
 * unreachable, so a settings outage degrades to live-site behaviour rather
 * than breaking checkout.
 */
export const getSettings = cache(async (): Promise<Record<SettingKey, SettingValue>> => {
  const resolved = { ...SETTING_DEFAULTS } as Record<string, unknown>;
  try {
    const rows = await prisma.setting.findMany();
    for (const row of rows) {
      if (row.key in SETTING_DEFAULTS) {
        resolved[row.key] = parse(row.value, SETTING_DEFAULTS[row.key as SettingKey]);
      }
    }
  } catch (err) {
    console.error('[settings] falling back to defaults', err);
  }
  return resolved as Record<SettingKey, SettingValue>;
});

export async function getSetting<K extends SettingKey>(key: K): Promise<(typeof SETTING_DEFAULTS)[K]> {
  const all = await getSettings();
  return all[key] as (typeof SETTING_DEFAULTS)[K];
}

/** Shapes one key/value into the row the Setting table stores. */
function settingRow(key: SettingKey, value: string | number | boolean) {
  const sample = SETTING_DEFAULTS[key];
  const type = typeof sample === 'number' ? 'number' : typeof sample === 'boolean' ? 'boolean' : 'string';
  return { key, value: String(value), type, group: key.split('.')[0] };
}

export async function setSetting(key: SettingKey, value: string | number | boolean): Promise<void> {
  const row = settingRow(key, value);
  await prisma.setting.upsert({
    where: { key },
    create: row,
    update: { value: row.value, type: row.type, group: row.group },
  });
}

/**
 * Writes many settings as one batch.
 *
 * The admin form saves every field it owns on each submit — nineteen of them —
 * and writing those one await at a time is nineteen sequential round trips to
 * a database that is not on this machine. On a busy shared host that is enough
 * to push a single save past the gateway's timeout, and the admin sees a 504
 * with no idea whether anything was written. One transaction is one round trip,
 * and it is atomic: a save either lands completely or not at all, so a timeout
 * can never leave half the store's settings updated.
 */
export async function setSettings(
  entries: Iterable<readonly [SettingKey, string | number | boolean]>,
): Promise<void> {
  const rows = [...entries].map(([key, value]) => settingRow(key, value));
  if (rows.length === 0) return;

  await prisma.$transaction(
    rows.map((row) =>
      prisma.setting.upsert({
        where: { key: row.key },
        create: row,
        update: { value: row.value, type: row.type, group: row.group },
      }),
    ),
  );
}
