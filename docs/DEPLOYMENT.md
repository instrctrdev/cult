# Deployment — Hostinger

Targets **Hostinger Business / Cloud hosting with Node.js support** plus Hostinger
MySQL. No VPS, no AWS, no Cloudinary, no Redis.

```
Customer → your-cult-domain.example (Hostinger)
              ├── Next.js (SSR + static)
              ├── API route handlers
              ├── MySQL (Hostinger)
              └── UPLOAD_DIR outside nodejs  ← product & banner media
                        ↓
                  Cashfree (payments)
```

---

## 1. Requirements

| Item | Value |
|---|---|
| Node.js | **20.11+**, 22 LTS recommended (`engines` enforces `>=20.11 <23`) |
| MySQL | 8.0+ |
| Disk | ~1 GB for the app, plus media (the full catalogue import is ~7 MB) |
| Memory | 1 GB minimum; 2 GB comfortable for builds |

If your plan cannot run Node, this application cannot run there — it needs a Node
process, not PHP. Hostinger's Business/Cloud tiers with the Node.js app manager are
the correct product.

---

## 2. Create the database

In hPanel → **Databases → MySQL Databases**, create a database and user, and grant
full privileges. Note the host (often `localhost`, sometimes a dedicated hostname).

```
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/cult"
```

If the password contains `@ : / ?` or `#`, URL-encode it (`@` → `%40`).

---

## 3. Environment variables

Set these in the **Environment variables** step of Hostinger's Node.js Web App
deployment. Hostinger reads variable names from the repository, but you must
provide their values. **Never commit `.env`.**

```bash
DATABASE_URL="mysql://user:pass@localhost:3306/cult"
NEXTAUTH_SECRET="<openssl rand -base64 32>"

NEXT_PUBLIC_SITE_URL="https://your-cult-domain.example"
NEXT_PUBLIC_SITE_NAME="CULT"

PAYMENT_PROVIDER="cashfree"
PAYMENT_API_KEY="<live client id>"
PAYMENT_SECRET="<live client secret>"
CASHFREE_BASE_URL="https://api.cashfree.com/pg"
CASHFREE_API_VERSION="2025-01-01"
# One Click Checkout: Cashfree signs the customer in by phone and supplies
# the delivery address, so our own checkout does not collect one on prepaid
# orders. Set to "false" to fall back to collecting the address ourselves.
CASHFREE_ONE_CLICK_CHECKOUT="true"
NEXT_PUBLIC_PAYMENT_PROVIDER="cashfree"
NEXT_PUBLIC_CASHFREE_MODE="production"

SHIPPING_PROVIDER="manual"

# Use an absolute, writable path outside Hostinger's replaceable nodejs build directory.
UPLOAD_DIR="/home/YOUR_USER/domains/YOUR_DOMAIN/cult-uploads"
NEXT_PUBLIC_UPLOAD_PATH="/uploads"
MAX_UPLOAD_MB="8"
```

Variables prefixed `NEXT_PUBLIC_` are compiled into the browser bundle — put nothing
secret there. The server env is validated at boot, so a missing secret fails the
deploy rather than a checkout.

---

## 4. Build & start

| Setting | Value |
|---|---|
| Install command | `npm ci --include=dev` |
| Build command | `npm run build` |
| Start command | `npm start` |
| Application root | repository root |
| Application URL | `https://your-cult-domain.example` |

`npm run build` applies committed database migrations and generates the Prisma client
before compiling the app. The Hostinger database must already exist and
`DATABASE_URL` must be available during the build.

`npm start` binds `$PORT`, which Hostinger injects — do not hard-code a port.

`next.config.mjs` sets `output: 'standalone'`; the build copies Next's static assets
and the repository's `public/` images into the standalone bundle. `npm start` runs
its generated `server.js`. If Hostinger asks for these fields manually, use
`.next/standalone` as the output directory and `server.js` as the entry file.

### Deploy sequence

```bash
npm ci --include=dev
npm run build          # includes `prisma migrate deploy`
npm start
```

First deploy only:

```bash
npm run db:seed                       # sizes, colours, categories, settings, banners
npm run admin:create -- --email you@your-cult-domain.example --password '…' --role SUPER_ADMIN
# Optional: set IMPORT_SOURCE_URL to your CULT Shopify storefront before importing.
# IMPORT_SOURCE_URL=https://your-cult-store.example npm run import:shopify
```

Then set real stock in **Admin → Inventory** — the public feed exposes availability
but not counts, so imported variants are seeded at 1 and flagged.

---

## 5. Prisma migrations

| Situation | Command |
|---|---|
| Change the schema locally | `npm run db:migrate -- --name describe_change` |
| Apply to staging/production | `npm run db:deploy` |
| Inspect data | `npm run db:studio` |
| Verify drift before deploying | `npx prisma migrate status` |

**Never** run `migrate dev`, `db push` or `migrate reset` against production —
the first two can drop columns, the third drops everything.

Always take a backup before `db:deploy` (§9).

---

## 6. Domain & SSL

1. hPanel → **Domains** → point `your-cult-domain.example` at the hosting account.
2. DNS: `A` record for `@`, `CNAME www → your-cult-domain.example`.
3. hPanel → **SSL** → issue the free Let's Encrypt certificate for both
   `your-cult-domain.example` and `www.your-cult-domain.example`, then enable **Force HTTPS**.
4. Set `NEXT_PUBLIC_SITE_URL="https://your-cult-domain.example"` — canonicals, the sitemap and
   webhook URLs all derive from it.

`next.config.mjs` already sends HSTS (`max-age=63072000; includeSubDomains; preload`),
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`.

> Enable HSTS only once HTTPS is confirmed working — browsers cache it for two years.

### Migrating from the Shopify storefront

Old product URLs are handled automatically: `/collections/:slug` → `/category/:slug`
via a permanent redirect, and `/product/<old-handle>` 301s to the new slug using
`Product.legacyHandle`. This matters here because several live handles disagree with
their product (a shirt sits at `/products/beige-shaket`).

---

## 7. Media storage

Product and banner images are written to `UPLOAD_DIR` on the Hostinger disk and
served by `/uploads/...`, with `Cache-Control: public, max-age=31536000, immutable`.

- Set `UPLOAD_DIR` to an absolute directory outside `/nodejs` and `/public_html`,
  for example `/home/YOUR_USER/domains/YOUR_DOMAIN/cult-uploads`. Create it with
  SSH and ensure the Node.js app can write to it. Hostinger replaces the app
  build directory on redeploy; a relative `./public/uploads` would lose media.
- Keep `NEXT_PUBLIC_UPLOAD_PATH=/uploads`; this is the URL prefix, not a disk path.
- Include the `UPLOAD_DIR` directory in backups (§9).

Each upload produces a WebP original (≤2000px) plus 400/800/1200/1600 derivatives.
Budget roughly 1 MB per product across all sizes.

---

## 8. Payments & webhooks

In the Cashfree merchant dashboard (production, not sandbox), set the webhook
notify URL to:

```
https://your-cult-domain.example/api/webhooks/payment
```

The handler verifies a `base64(HMAC-SHA256(clientSecret, timestamp + rawBody))`
signature against the `x-webhook-signature` header, using `PAYMENT_SECRET` as the
client secret. Unsigned or mis-signed events are recorded and rejected, never
applied.

Confirm One Click Checkout is enabled on the live merchant account before setting
`CASHFREE_ONE_CLICK_CHECKOUT="true"` — without it, `/api/checkout/express` refuses
every request and checkout displays an error. Configure Cashfree One Click Checkout
before customers can place orders; the storefront has no alternate checkout form.

**Test with a real ₹1 transaction** before opening the store: place a prepaid order
through the actual Buy Now / bag flow (not the sandbox OTP `111000` — that only
works against `sandbox.cashfree.com`), confirm the webhook arrives, and confirm the
order moves to `CONFIRMED` with the address Cashfree collected attached to it.

If `PAYMENT_API_KEY`/`PAYMENT_SECRET` are absent, the app falls back to the manual
provider: prepaid is hidden at checkout and COD still works. It never fabricates a
successful payment.

### Meta ads

For browser and server Purchase events to deduplicate, configure the same primary
dataset ID in `NEXT_PUBLIC_META_PIXEL_ID` and generate `META_CAPI_ACCESS_TOKEN` for
that dataset. When several comma-separated Pixel IDs are configured, server events
are sent to the first ID. Leave `META_CAPI_TEST_EVENT_CODE` empty outside a test.

Schedule the order-expiry worker every 10-15 minutes in hPanel using the existing
`CRON_SECRET`:

```bash
curl -fsS -X POST https://your-cult-domain.example/api/cron/expire-orders \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 9. Backups

Hostinger's automatic backups are a safety net, not a strategy — take your own
before every deploy.

### Database

```bash
# On the server, or via SSH
mysqldump --single-transaction --quick --routines \
  -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" | gzip > "cult-$(date +%F-%H%M).sql.gz"
```

`--single-transaction` gives a consistent snapshot without locking writes.

Restore:

```bash
gunzip < cult-2026-08-19-1200.sql.gz | mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME"
```

### Media

```bash
tar czf "uploads-$(date +%F).tar.gz" -C /home/YOUR_USER/domains/YOUR_DOMAIN cult-uploads
```

### Suggested schedule

| What | Frequency | Retention |
|---|---|---|
| Database | Daily, plus before every deploy | 30 days |
| `UPLOAD_DIR` | Weekly, plus after bulk uploads | 90 days |
| Off-site copy | Weekly | 90 days |

Keep at least one copy off the Hostinger account. **Restore-test quarterly** — an
untested backup is a hope, not a backup.

---

## 10. Post-deploy verification

```bash
curl -I https://your-cult-domain.example                    # 200, HSTS present
curl -s https://your-cult-domain.example/robots.txt         # correct sitemap URL
curl -s https://your-cult-domain.example/sitemap.xml | head # real product URLs
curl -I https://your-cult-domain.example/admin/dashboard    # 307 → /admin/login
```

Then, in a browser:

- [ ] Homepage renders with real products and images
- [ ] A product page shows correct price, sizes and stock
- [ ] Add to bag → cart total matches ₹99 shipping / ₹7 per item
- [ ] A COD order completes and appears in **Admin → Orders**
- [ ] A prepaid ₹1 order settles and reaches `CONFIRMED`
- [ ] Entering tracking in the admin appears on the customer's order page
- [ ] `/admin` is unreachable when signed out

---

## 11. Operations

**Logs** — hPanel → Node.js → Logs. The app logs provider failures, webhook
problems and unhandled errors with context; it never logs secrets or card data.

**Zero-downtime-ish releases** — `npm ci && npm run db:deploy && npm run build`, then
restart. Keep migrations backwards-compatible (add columns before removing
old ones) so a brief version overlap is safe.

**Scaling caveat** — the rate limiter is in-process. If the app is ever run as more
than one instance, move it to a shared store first
(`src/lib/rate-limit.ts`), or the per-IP budgets multiply by the instance count.
