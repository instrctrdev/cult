/**
 * `@cashfreepayments/cashfree-js` ships no TypeScript types (it is a thin,
 * dependency-free loader — see its package.json). This covers only the
 * surface this app actually calls; broaden it if more of the SDK is used.
 */
declare module '@cashfreepayments/cashfree-js' {
  export interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    redirectTarget?: '_self' | '_modal' | '_blank';
  }

  export interface CashfreeCheckoutResult {
    error?: { message?: string };
    redirect?: boolean;
  }

  export interface Cashfree {
    checkout(options: CashfreeCheckoutOptions): Promise<CashfreeCheckoutResult | void>;
  }

  export function load(options: { mode: 'sandbox' | 'production' }): Promise<Cashfree>;
}
