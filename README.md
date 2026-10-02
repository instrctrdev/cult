# CULT — E-commerce Platform

Next.js storefront and commerce admin for CULT Clothing. The project includes
catalogue management, customer accounts, inventory, order processing, Cashfree
One Click Checkout, and local CULT demo products for development.

## Local setup

Requires Node.js 20.11–22 and MySQL 8. The local `.env` is excluded from Git; keep
production values in the hosting provider's secret environment settings.

```bash
npm ci
npm run db:deploy
npm run db:seed
npm run dev
```

The local seed creates `admin@cult.local` with the development password
`ChangeMe123!`, plus six demo products. Change the password before exposing this
environment to anyone else. Demo product photos are optional and should be
replaced with CULT's approved catalogue imagery.

## Production build

```bash
npm run db:deploy
npm run build
npm start
```

Set `DATABASE_URL`, a new `NEXTAUTH_SECRET`, the final `NEXT_PUBLIC_SITE_URL`,
and `NEXT_PUBLIC_SITE_NAME=CULT` for the target environment. Do not reuse the
local database or development secrets in production.

### Cashfree One Click Checkout

The local `.env` selects Cashfree sandbox. Configure sandbox `PAYMENT_API_KEY`
and `PAYMENT_SECRET`, set `CASHFREE_BASE_URL=https://sandbox.cashfree.com/pg`,
`CASHFREE_ONE_CLICK_CHECKOUT=true`, and
`NEXT_PUBLIC_CASHFREE_MODE=sandbox` to exercise One Click Checkout. Use
Cashfree production credentials, `https://api.cashfree.com/pg`, and SDK mode
`production` only after the merchant account and live webhook have been
configured. Never use live keys for local checkout testing.

Configure the Cashfree webhook at
`<NEXT_PUBLIC_SITE_URL>/api/webhooks/payment`. The application settles prepaid
orders only after server-side gateway verification or a verified webhook.

## Catalogue import

Do not import the historic YDURYA source snapshot into CULT. For a future CULT
Shopify import, set `IMPORT_SOURCE_URL` to CULT's storefront. Offline imports
must explicitly set `IMPORT_SOURCE_FILE` to a CULT catalogue JSON file before
running `npm run import:shopify -- --offline`.

## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local development server |
| `npm run build` | Apply migrations, generate Prisma client, build Next.js |
| `npm start` | Serve the production build on `$PORT` or 3000 |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:seed` | Seed settings, categories, homepage sections, and demo products |
| `npm run admin:create` | Create or promote a production admin account |
| `npm run check:payments` | Check gateway configuration without creating a payment |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

Deployment and operating notes live in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md),
and the current brand details are in [`docs/BRAND.md`](docs/BRAND.md).
