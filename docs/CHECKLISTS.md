# Checklists

## Security

### Implemented

**Input & output**
- [x] Every request body and query string parsed with Zod before reaching a service
- [x] All database access through Prisma — parameterised, no string-built SQL
- [x] React escapes by default; `dangerouslySetInnerHTML` is used in exactly two
      places, both with content sanitised at import (scripts, styles, forms and
      inline event handlers stripped): product descriptions and CMS pages
- [x] JSON-LD escapes `<` so a product name cannot break out of the script block
- [x] Uploads validated by **magic number**, not `Content-Type`; re-encoded through
      `sharp`, so original bytes are never persisted
- [x] Upload paths refuse anything resolving outside the upload root
- [x] Decompression-bomb guard (`limitInputPixels`) on image processing

**Authentication**
- [x] bcrypt, 12 rounds; passwords never logged or returned
- [x] Dummy hash comparison on unknown emails — no timing-based account enumeration
- [x] Identical error message for wrong email and wrong password
- [x] JWT (HS256) validated for signature, issuer, audience and expiry
- [x] Session must exist in the database, be unrevoked, unexpired, and the user
      active — a valid signature alone is not enough
- [x] `httpOnly`, `sameSite=lax`, `secure` in production
- [x] Password change or reset revokes every existing session
- [x] Reset tokens stored as SHA-256 hashes, single-use, 30-minute expiry

**Authorisation**
- [x] Two-layer admin gate: edge middleware (signature) + server layout (database)
- [x] `requirePermission()` on every mutating admin route
- [x] Four roles with explicit capability lists; nav filtering is cosmetic only
- [x] Customer resources scoped by `userId` in the query, not by a client-sent id
- [x] Guest order tracking requires order number **and** email

**Commerce integrity**
- [x] No endpoint accepts a price — all totals recomputed server-side
- [x] Coupon rules (window, limits, minimum, subset, per-user, first-order)
      re-evaluated on the server every time
- [x] Stock validated and reserved inside the order transaction
- [x] Overselling prevented by a conditional UPDATE under MySQL's row lock
- [x] `idempotencyKey` uniquely indexed — double submits cannot duplicate an order
- [x] Payment settled only by server-to-server verification or a signed webhook
- [x] Underpayment rejected explicitly
- [x] Webhook signatures verified with `timingSafeEqual`; replays are no-ops
- [x] No card data stored — provider references only

**Transport & headers**
- [x] HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
      `Permissions-Policy`
- [x] `/admin` sends `no-store` and `X-Robots-Tag: noindex`
- [x] Secrets server-only; nothing sensitive under `NEXT_PUBLIC_`
- [x] Stack traces never returned in production

**Rate limiting** — login (per IP and per account), register, password reset,
coupon attempts, checkout, cart writes, search, newsletter, order tracking.

**Auditing** — every admin mutation writes an `AuditLog` row (actor, entity, diff,
IP, user agent). Inventory changes additionally write an `InventoryLedger` entry.

### Before opening the store

- [ ] `NEXTAUTH_SECRET` regenerated for production (never reuse the dev value)
- [ ] Seeded `admin@cult.local` / `ChangeMe123!` **deleted or repassworded**
- [ ] Real admin accounts created with strong unique passwords
- [ ] Staff given the lowest role that lets them work
- [ ] `.env` absent from git (`git log --all --full-history -- .env` returns nothing)
- [ ] Database user limited to the application's schema
- [ ] HTTPS forced and certificate valid for apex and `www`
- [ ] Payment webhook signature verified with a real test event
- [ ] Backups running and a restore actually tested

### Known limitations

| Limitation | Impact | Fix when needed |
|---|---|---|
| Rate limiter is in-process | Budgets multiply if run as multiple instances | Shared store in `src/lib/rate-limit.ts` |
| No transactional email | Reset links must be delivered manually (logged server-side) | Add SMTP in `forgot-password/route.ts` |
| No CAPTCHA on register/login | Rate limits only | Add a provider if abuse appears |
| Content-Security-Policy not set | Relies on React escaping + sanitised HTML | Add a nonce-based CSP once third-party scripts are final |

---

## Performance

### Implemented

**Rendering**
- [x] Server components by default; `'use client'` only where interaction requires it
- [x] Product and category pages statically generated (`generateStaticParams`) with
      300s revalidation — most catalogue traffic never touches MySQL
- [x] Listing's first page server-rendered into the HTML; later pages fetched
- [x] SEO-critical content never client-rendered

**JavaScript**
- [x] 102 kB shared JS; homepage ~188 kB first load
- [x] No carousel library — native CSS scroll-snap
- [x] No charting library — the admin chart is inline SVG
- [x] `optimizePackageImports` for `lucide-react` and `framer-motion`
- [x] Quick-add fetches variants on open rather than embedding them in every card

**Images**
- [x] Every upload re-encoded to WebP with 400/800/1200/1600 derivatives
- [x] AVIF/WebP negotiation, explicit `sizes` per breakpoint
- [x] 16px inline blur placeholders — no layout shift
- [x] `priority` only above the fold; everything else lazy
- [x] Immutable one-year cache on `/uploads`
- [x] Originals capped at 2000px — a 4000px source is never served

**Database**
- [x] Indexes on every filtered column; full-text index on product name/description
- [x] Facet counts computed in bounded queries, not N+1
- [x] `Promise.all` for independent queries on every page
- [x] Prisma client reused via `globalThis` in development to protect the connection pool
- [x] `select` used to avoid over-fetching

**Fonts**
- [x] Cinzel, Cormorant Garamond and DM Sans self-hosted via `next/font` —
      no render-blocking third-party request, `display: swap`

**Motion**
- [x] `prefers-reduced-motion` honoured globally
- [x] Transitions limited to composited properties

### Before opening the store

- [ ] Lighthouse on a real device — target ≥90 performance, 100 accessibility
- [ ] Confirm `public/uploads` is served with the immutable cache header
- [ ] Check the slowest catalogue queries once real volume exists
- [ ] Consider `revalidate` tuning if the catalogue changes more often than 5 minutes

---

## Accessibility

- [x] Semantic landmarks (`header`, `nav`, `main`, `footer`), skip link
- [x] Every control reachable and operable by keyboard; Radix supplies focus traps
- [x] Visible high-contrast focus ring on all interactive elements
- [x] `aria-label` on every icon-only button; decorative icons `aria-hidden`
- [x] Form labels bound to controls; errors announced via `role="alert"` and
      `aria-describedby`
- [x] Live regions for cart quantity and result counts
- [x] **Every text pairing verified against WCAG AA (4.5:1)**, on both the page
      background and the raised surface tone:

      | Pairing | Ratio |
      |---|---|
      | ink on background | 16.54:1 |
      | muted (secondary) on background / surface | 8.29 / 7.97:1 |
      | faint (tertiary) on background / surface | 5.87 / 5.66:1 |
      | gold text on background / surface | 5.53 / 5.16:1 |
      | white on ink (primary button) | 17.40:1 |
      | white on gold (gold button) | 4.71:1 |
      | success / danger on background | 5.01 / 6.09:1 |

- [x] Brand gold `#8b6f47` measures 4.47:1 as text — just under AA — so a
      darkened `--gold-ink` (`#7a6140`) is used wherever gold carries words,
      while `--gold` stays exact for fills, badges and swatches
- [x] Sold-out sizes conveyed by text, not colour alone
- [x] Alt text on product images; `sr-only` context on ambiguous links
- [x] Infinite scroll always paired with a real "Load more" button
- [x] 44px minimum touch targets on mobile controls
- [x] `font-size: max(16px, 1rem)` on inputs to stop iOS zoom

---

## Go-live

**Homepage**
- [ ] Campaign artwork supplied for every band you intend to show
      (`assets/<key>_desk.png` + `<key>_mob.png`, then `npm run import:home-art`)
- [ ] Focal point checked per band at 390px — the burned-in wording must survive
- [ ] Band order set in Admin → Homepage
- [ ] Bands without artwork left switched off
- [ ] Every band's link opens the right listing

**Payments**
- [ ] `npm run check:payments` passes
- [ ] Fastrr webhook set to `/api/webhooks/payment`
- [ ] One real ₹1 prepaid order settles to CONFIRMED

**Data**
- [ ] `npm run import:shopify` run against production
- [ ] Real stock counts set in **Admin → Inventory** (imports seed 1 unit)
- [ ] Products flagged "needs attention" reviewed
- [ ] Product photography replaced where images are flagged `AI`
- [ ] Homepage hero and split banners uploaded (desktop + mobile crops)
- [ ] Policy pages reviewed — the contact page imported only a heading and needs
      real contact details added

**Commerce**
- [ ] Settings confirmed: ₹99 shipping, free over ₹999, ₹7 handling, ₹27 COD
- [ ] Test COD order end to end
- [ ] Test prepaid ₹1 order end to end, including the webhook
- [ ] Test a refund
- [ ] Test manual tracking → customer sees it

**SEO**
- [ ] `NEXT_PUBLIC_SITE_URL` set to the production domain
- [ ] `/sitemap.xml` and `/robots.txt` correct
- [ ] Google Search Console verified, sitemap submitted
- [ ] Old Shopify URLs redirect (spot-check `/products/beige-shaket`)
- [ ] Rich Results Test passes for a product page

**Operations**
- [ ] Backups scheduled and a restore tested
- [ ] Admin accounts issued; default credentials removed
- [ ] Analytics IDs set, if analytics is wanted
