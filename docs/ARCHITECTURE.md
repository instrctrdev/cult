# Architecture

## Layering

```
  Route handler / Server component      ← parses input (Zod), checks auth
            ↓
  Service (src/services)                ← ALL business logic and rules
            ↓
  Prisma                                ← parameterised SQL
            ↓
  MySQL
```

A UI component never decides a price, a permission or a stock level. It calls a
service (server components) or an API route (client components), and renders what
comes back.

---

## Money

Money never touches a float.

- **Internally:** integer **paise** (`659.00` → `65900`).
- **At the database boundary:** `Decimal(10,2)` via `Prisma.Decimal`.
- **In DTOs:** fields are named `…Paise` so the unit is visible at every call site.

`src/lib/money.ts` provides `toPaise`, `toDecimal`, `formatPaise`, `discountPercent`
and `apportion`.

`apportion` distributes an order-level discount across lines without losing or
inventing a paisa: it floors each share, then hands the remainder to the lines with
the largest fractional parts. The apportioned values always sum exactly to the total.

---

## Pricing engine

`src/services/pricing.service.ts` is the **single** place an order total is decided.
Both the cart display and order creation call it, so the number the customer sees is
produced by the same code that charges them.

```
subtotal      = Σ (server-read variant price × quantity)
discount      = coupon evaluated server-side against the real line set
netSubtotal   = subtotal − discount
shipping      = 0 if netSubtotal ≥ ₹999 (or coupon grants free shipping) else ₹99
handling      = ₹7 × total units
codFee        = ₹27 when payment method is COD
tax           = optional, off by default (live prices are tax-inclusive)
total         = netSubtotal + shipping + handling + codFee + tax
```

Two deliberate decisions:

- **The free-shipping threshold is tested against the post-discount total**, so a
  coupon cannot be used to unlock free shipping the order no longer qualifies for.
- **An invalid coupon never blocks pricing.** It is dropped and reported, so a
  stale code cannot make the cart un-renderable.

### Why frontend prices are impossible to forge

`POST /api/checkout` is retired and returns `410 GONE`. Storefront checkout uses
`POST /api/checkout/express` to create a Cashfree One Click Checkout session.
Order totals, inventory and payment settlement are handled by the express
checkout intent and its server side verification after Cashfree confirms payment.

---

## Inventory

Variant-level and reservation-based:

```
available = quantity − reserved
```

| Phase | Effect |
|---|---|
| Checkout begins | `reserved += n` (inside the order transaction) |
| Payment confirmed | `quantity −= n`, `reserved −= n` |
| Payment fails / order cancelled while pending | `reserved −= n` |
| Cancelled after confirmation, or returned | `quantity += n` |

Every one of these appends an `InventoryLedger` row recording the reason, the signed
deltas, the resulting figures and the actor. Stock never changes silently.

### The overselling guard

The reservation is a conditional UPDATE evaluated by MySQL while it holds the row
lock:

```sql
UPDATE Inventory
   SET reserved = reserved + ?
 WHERE id = ?
   AND quantity - reserved >= ?
```

A losing racer updates **zero rows**, which raises `OUT_OF_STOCK` and rolls back the
whole transaction — order, reservations and coupon redemption together.

Verified: two shoppers checked out simultaneously for the last unit. One received
`CU-2026-0002`; the other received *"Someone just took the last of this size."*
No inventory row anywhere went negative.

---

## Orders

### Idempotency

The client generates one UUID per checkout attempt and sends it as
`idempotencyKey`. It is stored under a **unique index** on `Order`. A double-tapped
"Place order", a retried request or a flaky connection therefore returns the
original order instead of creating a second one. The key is only regenerated after a
*failed* attempt.

### Status flow

```
PENDING ─┬─ (prepaid: payment verified) ──→ CONFIRMED ──→ PROCESSING
         └─ (COD: immediately)                              │
                                                            ↓
                              SHIPPED ──→ OUT_FOR_DELIVERY ──→ DELIVERED
                                                            │
CANCELLED ←── (before dispatch)                             ↓
                                          RETURN_REQUESTED ──→ RETURNED ──→ REFUNDED
```

`OrderEvent` records every transition with its source (`checkout`, `payment`,
`admin`, `customer`) and is what the customer's tracking timeline renders.

---

## Payments

`PaymentService` talks only to a `PaymentProvider` interface:

```ts
interface PaymentProvider {
  isConfigured(): boolean
  createPayment(input): Promise<CreatePaymentResult>
  verifyPayment(providerOrderId): Promise<VerifyPaymentResult>
  parseWebhook(rawBody, headers): Promise<WebhookResult>
  refundPayment(ref: { providerOrderId, providerPaymentId }, amountPaise, reason?): Promise<RefundResult>
}
```

`refundPayment` takes an object rather than a bare id because gateways
disagree on what a refund is scoped to — Cashfree addresses refunds by
*order* id, Fastrr (had it shipped one) would have addressed a *payment* id.
Both are always available on the `Payment` row.

Implementations: **`CashfreeProvider`** (the active gateway), **`FastrrProvider`**
(Shiprocket Checkout — kept available as an alternative), and **`ManualProvider`**
(fallback — COD-only, prepaid hidden).

### Cashfree integration — the active gateway

Cashfree's Payment Gateway is a publicly documented REST API plus an official
npm SDK (`@cashfreepayments/cashfree-js`), built for custom web apps — not a
platform-specific plugin the way Fastrr's Shopify bundle is. Every endpoint,
field name and status value below is taken directly from Cashfree's published
API reference (docs.cashfree.com) and its own webhook-verification sample
(github.com/cashfree/cashfree-pg-webhook), and the signature math has been
independently reproduced against that sample and confirmed byte-for-byte.

**Base URLs**

| | |
|---|---|
| Sandbox | `https://sandbox.cashfree.com/pg` |
| Production | `https://api.cashfree.com/pg` |

**Server-side REST — `src/services/payment/cashfree.provider.ts`**

| Endpoint | Purpose |
|---|---|
| `POST /orders` | Create a checkout session; returns a `payment_session_id` |
| `GET /orders/{order_id}` | Authoritative order status — the only response this app treats as settlement |
| `GET /orders/{order_id}/payments` | Fetched only once `PAID`, to record the gateway's own payment id for reconciliation |
| `POST /orders/{order_id}/refunds` | Refund, scoped by order id |

Every request carries `x-client-id`, `x-client-secret` and `x-api-version` as
plain headers — unlike Fastrr, there is nothing to sign on outgoing requests.
`order_id` is set to **our own order number**, not a Cashfree-generated id, so
`providerOrderId` is the same order number end to end.

**Browser handoff — `src/lib/cashfree/sdk.ts`**

```ts
const cashfree = await load({ mode: 'sandbox' | 'production' });
cashfree.checkout({ paymentSessionId, redirectTarget: '_modal' });
```

`paymentSessionId` is the value `POST /orders` returned — never a cart read
off the page. The modal keeps the customer in-page, which is the closest
equivalent to a single-click checkout this gateway offers. On completion the
browser returns to `returnUrl`; that is a UX courtesy only —
`/checkout/confirmation/[orderNumber]` re-verifies against `GET /orders/{id}`
unconditionally whenever a prepaid order is still `PENDING`, regardless of how
the customer got there.

**The webhook is genuinely signed, unlike Fastrr's**

```
signature = base64( HMAC-SHA256( client_secret, x-webhook-timestamp + rawBody ) )
```

Headers `x-webhook-signature` / `x-webhook-timestamp`; the string hashed is
the exact raw request body with the timestamp prepended, no separator —
confirmed against Cashfree's own Node.js reference implementation, and
independently reproduced in this codebase to produce an identical signature
for identical input. `signatureOk` genuinely reflects verification here.

Even so, `PaymentService.handleWebhook` never settles a payment on the webhook
payload alone — receiving one only triggers `verifyAndSettle`, which re-fetches
from `GET /orders/{order_id}`. Every provider in this app is held to that same
discipline regardless of whether its webhook is signed.

**Refunds**

`POST /orders/{order_id}/refunds` — real and implemented, unlike Fastrr's
integration which has no refund endpoint at all. `refund_id` is generated
per attempt (`{orderId}-{timestamp}`) so a retried admin click cannot double-refund.

**Open item**

`CASHFREE_API_VERSION` defaults to `2023-08-01`, Cashfree's long-stable,
widely-referenced version. Their "latest" docs page pointed at a newer dated
version at the time this was written. Either works; confirm which your
account is provisioned for in the dashboard, and if requests start failing
with 400s, this is the first thing to check.

### Fastrr integration — kept as an alternative gateway

Confirmed against Shiprocket's real spec (their **"Full checkout custom
Integration APIs [PUBLIC]"** Postman collection, provided directly by
support). Set `PAYMENT_PROVIDER="fastrr"` to use this instead of Cashfree.

### An order is never marked paid on the browser's word

There are exactly two code paths that can settle a payment:

1. `PaymentService.verifyAndSettle()` — asks the gateway directly, server-to-server.
2. A webhook whose **HMAC-SHA256 signature is verified** with `timingSafeEqual`.

The browser's redirect only *triggers* check (1); it is never itself believed. An
underpayment is rejected explicitly: if the settled amount is below the order total,
the payment is marked `FAILED` with the mismatch recorded.

`ManualProvider` deliberately does **not** simulate success — prepaid orders stay
`PENDING` until a human confirms them. There is no code path anywhere in this
application that marks money received without a provider confirming it.

Webhooks are recorded in `WebhookEvent` before being acted on, keyed by the
provider's event id, so replays are no-ops and unsigned events are auditable
without being trusted.

**Card data is never stored.** Only provider references (`providerOrderId`,
`providerPaymentId`, `providerRefundId`) and the raw payload for reconciliation.

### Fastrr integration — confirmed against Shiprocket's real spec

Earlier revisions of this document guessed at Fastrr's REST shape from
inspecting the Shopify plugin bundle. Shiprocket support has since provided
their actual **"Full checkout custom Integration APIs [PUBLIC]"** Postman
collection, and everything below reflects that spec directly rather than an
inference — including one real gap in what it documents (see *Open items*).

**Base URLs**

| | |
|---|---|
| Staging | `https://fastrr-api-dev.pickrr.com` |
| Production | `https://checkout-api.shiprocket.com` |

**Server-side REST — `src/services/payment/fastrr.provider.ts`**

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/access-token/checkout` | Create a checkout session from cart lines; returns a short-lived `token` |
| `POST /api/v1/custom-platform-order/details` | Authoritative order + payment status — the only response this app treats as settlement |
| `POST /api/v1/custom-platform-order/details/transactions` | Gateway-level transaction log (Razorpay txn id, method, amounts) |

Every request carries `X-Api-Key` and `X-Api-HMAC-SHA256` — an HMAC-SHA256 of
the request body, Base64-encoded, keyed with the API secret.

**Browser handoff — `src/lib/fastrr/sdk.ts`**

Fastrr's checkout UI bundle turns out to be genuinely platform-agnostic — the
same file (`assets/js/channels/shopify.js`, oddly named regardless of
platform) is loaded for Shopify *and* for custom storefronts. What differs is
which entry point you call:

```js
window.HeadlessCheckout.addToCart(event, token)
```

`token` is the value returned by `POST /api/v1/access-token/checkout` — never
a cart read off the page. This is the actual custom-platform integration
point Shiprocket's own docs demonstrate, replacing the earlier `buyDirect`
guess (which was inferred from the Shopify bundle and is not part of this
spec).

On completion the browser is redirected to
`<returnUrl>?oid=<fastrr_order_id>&ost=SUCCESS|FAILED`. That redirect is a UX
courtesy only: `/checkout/confirmation/[orderNumber]` re-verifies with
`custom-platform-order/details` unconditionally whenever a prepaid order is
still `PENDING`, regardless of what the query string says.

**Why the incoming webhook is never trusted directly**

The `Order` webhook Fastrr sends to `<SELLER_REGISTERED_WEBHOOK_URL>` (set
once, account-wide, in the merchant dashboard — there is no per-request field
for it) carries **no signature at all** in the published spec, only
`Content-Type: application/json`. Fastrr's own docs say as much: *"webhooks
may be sent more than once"* and recommend a periodic status check as a
failsafe.

`PaymentService.handleWebhook` reflects that directly: an unsigned event is
never applied to the order. Receiving it only looks up which order to check by
`providerOrderId`, then calls `verifyAndSettle`, which re-fetches from the
signed `custom-platform-order/details` endpoint — the same authoritative path
a manual page reload would take.

**No refund endpoint**

This spec does not define one. `refundPayment` throws a clear `PAYMENT_ERROR`
— *"Fastrr has no refund API in the current integration. Process this refund
from the Shiprocket dashboard."* — rather than calling something invented.
Refunds go through the Fastrr/Shiprocket dashboard, or directly through the
underlying gateway using the `pg_transaction_id` from the transactions
endpoint, until Shiprocket confirms an API for this.

**Open items to confirm with Shiprocket support**

1. **Exact HMAC canonicalisation.** The spec says "HMAC SHA256 in Base64
   calculated using Api Secret" and links to a generic external calculator —
   not their own byte-for-byte specification. This implementation hashes the
   exact JSON string sent as the request body (`sign()` in
   `fastrr.provider.ts`), the conventional choice, but it is not confirmed
   against their server. `npm run check:payments` signs one real request so a
   mismatch here fails loudly and immediately rather than on a customer order.
2. **Refunds** — confirm whether an API exists that the public collection does
   not list.

### Swapping gateways

Write a class implementing `PaymentProvider`, register it in
`paymentProvider()` (`src/services/payment.service.ts`), set `PAYMENT_PROVIDER`.
Nothing else changes — this is exactly how Cashfree was added alongside Fastrr.

> **Fastrr credentials:** per-merchant, issued in the Shiprocket Checkout
> dashboard rather than published. See `src/services/payment/fastrr.provider.ts`
> for the endpoints they map to.

---

## Shipping

Fulfilment is handled **outside** this system. Staff enter the courier, tracking
number and estimated delivery date in **Admin → Orders → Shipping & tracking**, and
move the order through its statuses. No carrier API is called.

Saving tracking details:
1. creates or updates the order's single `Shipment` row,
2. appends an `OrderEvent` (which the customer sees), and
3. advances the order status to match — `IN_TRANSIT → SHIPPED`,
   `OUT_FOR_DELIVERY`, `DELIVERED`, `RTO → RETURNED`.

Cancelled, returned and refunded orders are never moved forward by a shipment
update.

### The carrier seam

`src/services/shipping/` already defines the full provider contract:

```ts
interface ShippingProvider {
  isAutomated(): boolean
  createShipment(input): Promise<CreateShipmentResult>
  track(awbCode): Promise<TrackResult>
  cancel(providerOrderId): Promise<void>
}
```

Today the only implementation is `ManualShippingProvider`, whose methods refuse
rather than pretending to reach a carrier. Adding Shiprocket, Delhivery or any other
API later means writing one class, registering it in `shippingProvider()`, and
setting `SHIPPING_PROVIDER`. It would populate exactly the same `Shipment` rows the
admin fills in by hand — the order model, admin screens and customer tracking view
would not change.

---

## Authentication & authorisation

- **Passwords:** bcrypt, 12 rounds. A login for an unknown email still performs a
  dummy comparison so response timing cannot enumerate accounts.
- **Sessions:** a signed JWT (HS256, `jose`) whose `sid` must match a live row in
  `Session`. A valid signature alone is not enough — the session must be unrevoked
  and unexpired, and the user still active. That is what makes logout, password
  changes and deactivation take effect immediately.
- **Cookies:** `httpOnly`, `sameSite=lax`, `secure` in production.

### Two-layer admin gate

| Layer | Runs on | Checks |
|---|---|---|
| `src/middleware.ts` | Edge | Cookie signature + role claim — fast rejection |
| `app/(admin)/admin/layout.tsx` | Node | Database: session live, user active, role sufficient |
| `requirePermission(...)` | Node | The specific capability, on every mutating route |

The edge check cannot query the database, so it is a first pass only. A stale or
stolen cookie that passes it still fails the layout and the route.

`/admin/login` lives in a separate route group (`(admin-auth)`) so it sits outside
the gate — otherwise an unauthenticated admin would be redirected in a loop.

---

## Rate limiting

In-process fixed-window limiter (`src/lib/rate-limit.ts`). Redis is explicitly ruled
out by the cost constraint, and the Hostinger Node target runs a single process,
where a module-level Map is an accurate limiter.

| Bucket | Budget |
|---|---|
| Login (per IP) | 20 / 15 min |
| Login (per account) | 8 / 15 min |
| Register | 5 / hour |
| Forgot password | 5 / hour |
| Coupon attempts | 10 / 5 min |
| Checkout | 15 / 10 min |
| Cart writes | 60 / min |
| Search | 120 / min |

> **If the app is ever scaled to multiple instances, this must move to a shared
> store.** It is the one component that assumes a single process.

---

## Media

Uploads are validated by **magic number**, not by the caller's `Content-Type`, then
re-encoded with `sharp` to WebP at up to 2000px, plus 400/800/1200/1600 derivatives
and a 16px blur placeholder. Only derived files are written — the original bytes are
never persisted, which also strips anything hidden inside them.

Files land on the Hostinger filesystem under `public/uploads`; MySQL stores paths
only. Deletion refuses any path that resolves outside the upload root.

The pipeline lives in `src/lib/image-store.ts` (runtime-neutral) so the standalone
importer can reuse it; `MediaService` is the `server-only` wrapper that maps
failures onto the app's error contract.

---

## Analytics

Components emit typed events through `track()` and never reference a vendor:

```ts
track({ name: 'add_to_cart', item: {...}, value: 659 })
```

`src/lib/analytics/providers.ts` fans out to GA4 and Meta Pixel, each inert unless
its env var is set — so the store ships with **no third-party tracking by default**.
Every provider call is wrapped, so a blocked script can never throw inside a click
handler and break an add-to-cart.

---

## Error handling

Every route handler is wrapped in `withErrorHandling`, which produces one envelope:

```json
{ "error": { "code": "OUT_OF_STOCK", "message": "Only 1 left in this size.", "details": {...} } }
```

`AppError` carries a typed code mapped to an HTTP status. Zod failures become
`VALIDATION_ERROR` with per-field paths. Anything unrecognised is logged in full
server-side and returns a generic message — **stack traces never reach production
clients**, and `error.tsx` shows only the digest.

---

## Performance

- Server components by default; `'use client'` only where interaction demands it.
- The listing's first page is server-rendered, so the grid is in the initial HTML;
  later pages fetch client-side.
- Product and category pages are statically generated with `generateStaticParams`
  and revalidated (300s), so most catalogue traffic never touches MySQL.
- `next/font` self-hosts Cinzel, Cormorant Garamond and DM Sans — no render-blocking
  Google Fonts request, no layout shift.
- Images: AVIF/WebP, explicit `sizes` per breakpoint, blur placeholders,
  `priority` only on above-the-fold images.
- Carousels are native CSS scroll-snap — no carousel library.
- The admin sales chart is inline SVG rather than a charting library.

Measured on the production build: **102 kB shared JS**, homepage **~188 kB** first load.
