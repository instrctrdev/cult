/**
 * Stand-ins for a guest whose real details only exist inside Cashfree until
 * payment completes.
 *
 * An order row needs an email and a phone from the moment it is created, but
 * an express checkout has neither: One Click Checkout collects them in
 * Cashfree's own sheet. These fill the gap and are overwritten by
 * `captureCollectedAddress` on settlement.
 *
 * They must never reach Cashfree. Pre-filling its form with a placeholder
 * invites the customer to leave it there — and an order carrying
 * `pending@checkout.cult.local` as its email can never be confirmed to anyone. Use
 * `isPlaceholder` to strip them before building a payment payload; Cashfree
 * accepts absent contact fields and renders them as empty inputs.
 */
export const PENDING_EMAIL = 'pending@checkout.cult.local';

/**
 * A single space rather than an empty string: Cashfree rejects a missing or
 * empty phone on some paths but accepts whitespace, and the sheet renders it
 * as a blank field.
 */
export const PENDING_PHONE = ' ';

/**
 * The generic name an order falls back to when no address has been captured
 * yet. Not stored anywhere — it appears only as a default — but it is just as
 * unhelpful pre-filled into Cashfree's form as the email is.
 */
export const PENDING_NAME = 'Customer';

/** True for a value that is one of the stand-ins above, or simply blank. */
export function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed === '' || trimmed === PENDING_EMAIL || trimmed === PENDING_NAME;
}
