# CULT — Brand Reference

This is the identity currently configured in the CULT application. The demo
catalogue is local testing content; replace it with CULT's approved product
details, prices, imagery, and policies before opening the store.

## Identity

- Name: **CULT**
- Legal display name: **CULT Clothing**
- Tagline: **Dress Like You Mean It.**
- Supporting line: **Modern pieces. A sharper point of view.**
- Motto: **Make It Your Uniform.**
- Instagram: [@cult.vizag](https://www.instagram.com/cult.vizag/)
- Website domain: set `NEXT_PUBLIC_SITE_URL` to CULT's confirmed production domain.

## Visual system

The active values are defined in `src/lib/brand.ts` and `src/app/globals.css`.

| Role | Value |
|---|---|
| Background | `#0c0c0d` |
| Raised surface | `#171719` |
| Sunken surface | `#222225` |
| Text | `#f5f5f4` |
| Accent | `#d4261e` |
| Success | `#5bbe80` |

The storefront uses Cinzel, Cormorant Garamond, DM Sans, and Dancing Script.

## Local demo catalogue

`npm run db:seed` creates six example products under the CULT brand so the
storefront and checkout can be exercised locally. Their product details and
image paths are placeholders, not approved live merchandise. Confirm final
prices, variant availability, product descriptions, and imagery with CULT
before publishing.

## Store settings to confirm

The seed includes ₹99 shipping, free shipping above ₹999, ₹7 handling per item,
and a ₹27 COD surcharge. Confirm these values, tax handling, pickup address,
and return window with CULT before launch. The seed creates empty homepage
banner slots; upload campaign artwork and review each destination link in the
admin.
