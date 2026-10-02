# API Reference

Base URL: `${NEXT_PUBLIC_SITE_URL}/api`

All request bodies are JSON and validated with Zod. All errors share one envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [ … ] } }
```

| Code | HTTP | Meaning |
|---|:--:|---|
| `BAD_REQUEST` | 400 | Malformed request |
| `UNAUTHENTICATED` | 401 | Sign-in required |
| `PAYMENT_ERROR` | 402 | Gateway refused or is unavailable |
| `FORBIDDEN` | 403 | Signed in, but not permitted |
| `NOT_FOUND` | 404 | No such resource |
| `CONFLICT` / `OUT_OF_STOCK` | 409 | State conflict / insufficient stock |
| `VALIDATION_ERROR` / `COUPON_INVALID` | 422 | Failed validation or coupon rules |
| `RATE_LIMITED` | 429 | Too many attempts (`details.retryAfterSeconds`) |
| `INTERNAL_ERROR` | 500 | Logged server-side; no stack trace returned |

Authentication is the `yd_session` httpOnly cookie. Guest carts use `yd_cart`.
Money in responses is always **integer paise** on `…Paise` fields.

---

## Catalogue

### `GET /api/products`
Faceted, paginated listing.

| Query | Type | Notes |
|---|---|---|
| `category` | csv | Category slugs |
| `size` | csv | Size codes (`S,M,L,XL`) |
| `color` | csv | Colour slugs |
| `minPrice`, `maxPrice` | int | **Rupees** |
| `inStock`, `onSale` | `1` | Flags |
| `q` | string | Search term |
| `sort` | enum | `featured` \| `newest` \| `price-asc` \| `price-desc` \| `discount` \| `name-asc` |
| `page`, `perPage` | int | `perPage` max 60 |

```json
{
  "products": [ { "id", "slug", "name", "image", "hoverImage",
                  "pricePaise", "compareAtPaise", "discountPercent",
                  "inStock", "sizes": [], "colors": [] } ],
  "total": 9, "page": 1, "perPage": 12, "totalPages": 1,
  "facets": {
    "sizes":  [ { "value": "M", "label": "M", "count": 9 } ],
    "colors": [ { "value": "black", "label": "Black", "count": 3, "meta": { "hex": "#1a1a1a" } } ],
    "categories": [ { "value": "shirts", "label": "Shirts", "count": 9 } ],
    "priceRangePaise": { "min": 65900, "max": 99900 }
  }
}
```

Facet counts are **product** counts, never variant counts. Size and colour facets
ignore their own active filter so a selection can be widened without clearing it.

`Cache-Control: public, s-maxage=60, stale-while-revalidate=300`

### `GET /api/products/[slug]`
Full PDP payload: images, variants (with `available`, `inStock`, `isLowStock`),
categories, details, rating summary. `404` if unpublished.

### `POST /api/products/by-ids`
`{ "ids": ["…"] }` → `{ "products": [...] }`. Max 100. Used by the guest wishlist.

### `GET /api/search`
`?q=` (≥2 chars) `&limit=` (≤20) → `{ products, categories, popular, total }`.
Rate limited 120/min. Queries are logged asynchronously for the "popular" list.

---

## Cart

All cart endpoints return the **complete recomputed cart**, so the client never
derives its own totals.

```json
{
  "id": "…", "itemCount": 2,
  "lines": [ { "id", "productId", "variantId", "slug", "name", "variantLabel",
               "sku", "image", "unitPricePaise", "quantity", "maxQuantity",
               "lineTotalPaise", "issue": null } ],
  "pricing": { "subtotalPaise", "discountPaise", "shippingPaise", "handlingPaise",
               "codFeePaise", "taxPaise", "totalPaise",
               "freeShippingRemainingPaise", "freeShippingThresholdPaise",
               "coupon": null }
}
```

`issue` is `OUT_OF_STOCK` or `QUANTITY_REDUCED` when stock changed under the customer.

| Endpoint | Body | Notes |
|---|---|---|
| `GET /api/cart` | — | Creates nothing |
| `POST /api/cart/items` | `{ variantId, quantity }` | `quantity` 1–10. `409 OUT_OF_STOCK` if beyond stock — the achievable quantity is still written |
| `PATCH /api/cart/items` | `{ itemId, quantity }` | `0` removes the line |
| `DELETE /api/cart/items?itemId=` | — | |
| `POST /api/cart/coupon` | `{ code }` | Validated server-side; 10 attempts / 5 min |
| `DELETE /api/cart/coupon` | — | |

---

## Account

| Endpoint | Body | Notes |
|---|---|---|
| `POST /api/auth/register` | `{ email, password, firstName?, lastName?, phone? }` | Password ≥8 with a letter and a number. Merges the guest cart. 5/hour |
| `POST /api/auth/login` | `{ email, password, wishlistIds? }` | Merges guest cart + wishlist. 20/15min per IP, 8/15min per account |
| `POST /api/auth/logout` | — | Revokes the server-side session |
| `POST /api/auth/forgot-password` | `{ email }` | Always the same response — accounts cannot be probed. See note below |
| `POST /api/auth/reset-password` | `{ token, password }` | Single-use, 30-min token; revokes all sessions |
| `PATCH /api/account/profile` | `{ firstName?, lastName?, phone? }` | |
| `POST /api/account/profile` | `{ currentPassword, newPassword }` | Change password |
| `GET/POST /api/account/addresses` | address | |
| `PATCH/DELETE /api/account/addresses/[id]` | | Ownership enforced in the service |
| `GET /api/wishlist` | — | `{ productIds: [] }` |
| `POST /api/wishlist` | `{ productId }` | Toggles; requires an account |

> **Password reset delivery.** No transactional email provider is configured — the
> brief rules out extra paid services. The reset link is written to the server log
> for manual delivery, and returned in the response body in development only.
> Wiring SMTP is a single change in `app/api/auth/forgot-password/route.ts`.

---

## Checkout & payments

### `POST /api/checkout` (retired)

```json
{
  "email": "…", "phone": "9876543210",
  "address": { "fullName", "phone", "line1", "line2?", "landmark?",
               "city", "state", "pincode", "country" },
  "saveAddress": false,
  "paymentMethod": "PREPAID" | "COD",
  "couponCode": null,
  "customerNote": null,
  "idempotencyKey": "<uuid>"
}
```

This legacy endpoint returns `410 GONE`. Storefront checkouts must start through
`POST /api/checkout/express`, which creates a Cashfree One Click Checkout session.

| Endpoint | Purpose |
|---|---|
| `POST /api/payments/create` | `{ orderId }` → gateway session. Amount comes from the stored order |
| `POST /api/payments/verify` | `{ orderId }` → re-checks with the gateway server-to-server. **The only client-triggered way an order becomes paid** |
| `POST /api/webhooks/payment` | Gateway callback. HMAC-SHA256 verified with `timingSafeEqual`; unsigned events are recorded but never applied; replays are no-ops |

---

## Orders

| Endpoint | Notes |
|---|---|
| `POST /api/orders/track` | `{ orderNumber, email }` — **both** required, so order numbers cannot be enumerated. 15/10min |
| `POST /api/orders/[id]/cancel` | `{ reason? }` — only PENDING/CONFIRMED/PROCESSING. Releases or restocks inventory and reverses coupon usage |
| `POST /api/orders/[id]/return` | `{ reason }` — DELIVERED only, within 3 days |

---

## Admin

All `/api/admin/*` routes require a staff session **and** the specific permission.
Every mutation writes an `AuditLog` entry.

| Endpoint | Permission | Purpose |
|---|---|---|
| `POST /api/admin/media` | `media.write` | Multipart upload. Magic-number validated, re-encoded to WebP with responsive sizes |
| `POST /api/admin/products` | `products.write` | Create |
| `PATCH/DELETE /api/admin/products/[id]` | `products.write` | Update / archive (soft delete) |
| `POST/PATCH/DELETE /api/admin/products/[id]/images` | `products.write` | Attach / reorder / delete (also removes files from disk) |
| `PUT/DELETE /api/admin/products/[id]/variants` | `products.write` | Replace variant set. Removed variants deactivate, never hard-delete |
| `PATCH /api/admin/inventory` | `inventory.write` | `{ variantId, quantity, note? }` — absolute quantity; writes a ledger entry |
| `POST /api/admin/categories`, `PATCH/DELETE .../[id]` | `categories.write` | Delete refuses while products remain |
| `POST /api/admin/coupons`, `PATCH/DELETE .../[id]` | `coupons.write` | |
| `POST /api/admin/banners`, `PATCH/DELETE .../[id]` | `banners.write` | Setting `videoUrl` switches the hero to video mode |
| `PATCH/DELETE /api/admin/reviews/[id]` | `reviews.write` | Approve / hide / remove. Content is never edited |
| `GET/PATCH /api/admin/settings` | `settings.read` / `.write` | Unknown keys are ignored |
| `PATCH /api/admin/orders/[id]/status` | `orders.write` | Applies stock consequences (e.g. restock on RETURNED) |
| `PUT/DELETE /api/admin/orders/[id]/shipment` | `orders.write` | **Manual tracking** — see below |
| `POST /api/admin/orders/[id]/refund` | `orders.refund` | `{ amount, reason? }` in rupees; capped at the amount captured |

### `PUT /api/admin/orders/[id]/shipment`

```json
{
  "courierName": "Delhivery",
  "awbCode": "AWB123456789",
  "trackingUrl": "https://…",
  "expectedDelivery": "2026-08-23",
  "status": "IN_TRANSIT",
  "notes": "Handed to courier"
}
```

No carrier API is called. Saving records the shipment, appends to the customer's
visible timeline, and advances the order status
(`IN_TRANSIT → SHIPPED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RTO → RETURNED`).

Valid `status` values: `PENDING`, `AWB_ASSIGNED`, `PICKUP_SCHEDULED`, `IN_TRANSIT`,
`OUT_FOR_DELIVERY`, `DELIVERED`, `RTO`, `FAILED`, `CANCELLED`.

---

## Misc

| Endpoint | Notes |
|---|---|
| `POST /api/newsletter` | `{ email, source? }` — upsert, 5/hour |
| `/sitemap.xml`, `/robots.txt` | Generated from live data |
