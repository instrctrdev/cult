# Homepage — editorial system

The homepage is a sequence of full-bleed **editorial bands**. It is a campaign
first and a storefront second: large photography, minimal chrome, and product
carousels only where an editor asks for one.

Nothing about the composition lives in code. Order, artwork, copy, links,
focal points and on/off state are all rows in `HomepageSection`, editable at
**Admin → Homepage**.

---

## Shape

| Breakpoint | Band ratio | Why |
|---|---|---|
| `< 768px` | **9:16** portrait | Matches the mobile artwork exactly, so nothing is cropped |
| `768–1023px` | 3:2 | Tablet middle ground |
| `≥ 1024px` | **16:9** | The editorial frame the campaign artwork is composed for |

Bands take their ratio from the artwork rather than from viewport height. An
earlier version used `80–100vh`, which cropped the wording burned into the
pictures — a 390×844 phone is 0.46 wide-to-tall, but the artwork is 0.5625, so
`object-fit: cover` ate the headline. Matching the ratio removes the crop
entirely.

Phones cap at `94svh` so a very tall device cannot stretch the poster. Desktop
is deliberately uncapped: capping a 16:9 band on a short window would re-crop
it horizontally and cut the campaign lockup, and a band running slightly past
the fold is normal editorial behaviour — it invites the scroll.

---

## Artwork

Two crops per band:

```
public/images/home/<key>-desktop.webp    16:9   (2400×1350 recommended)
public/images/home/<key>-mobile.webp     9:16   (1080×1920 recommended)
```

### The `assets/` workflow

Drop campaign files into `assets/` and run:

```bash
npm run import:home-art              # optimise + wire up
npm run import:home-art -- --dry-run # report only
```

Naming decides where each file lands:

```
<name>_desk.png   <name>_desktop.png   <name>-desktop.jpg    → 16:9
<name>_mob.png    <name>_mobile.png    <name>-mobile.jpg     → 9:16
```

`<name>` is matched against an alias table (`fresharrival` and `newarrival`
both mean `fresh-arrivals`, `polo` means `polos`, and so on) and otherwise
falls back to the slugified name — so `kurtas_desk.png` lands on the `kurtas`
band with no code change.

The importer re-encodes to WebP at 2400px (desktop) / 1200px (mobile).
**This matters:** the supplied PNGs were 3–4 MB each and came out at ~0.14 MB,
a ~95% reduction, with no visible loss at these sizes.

It then points the band at the new files and switches it on. Re-running is
safe.

### Why imported bands get no overlay

CULT's campaign artwork already carries its own typography — logo, headline
and "+ SHOP NOW" — on bright photography. Imported bands are therefore set to
`textMode: IMAGE` with `overlayStrength: 0`. A darkening gradient would only
muddy pictures that are already legible, and the app drawing a second headline
on top of the burned-in one would be worse.

### Focal point

Imported bands are anchored `left center`. The campaign lockup sits on the left
of the frame, and left-anchoring guarantees the headline survives on any
viewport whose ratio differs from the file's — for example `jackets_mob` is 2:3
rather than 9:16, so it *is* cropped horizontally on a phone, and anchoring
left keeps the words.

Change it per band with the nine-way focal control in the admin, or type any
CSS `object-position` value (`50% 35%`, `center top`).

---

## Accessibility and SEO with wording inside the image

Because the words are pixels, the band still emits real markup:

- a genuine `<h2>` per band, visually hidden in `IMAGE` mode
- the CTA text, so the link's accessible name reads "Polos — + SHOP NOW"
- editor-written `alt` text describing the photograph
- a plain `<a href>` wrapping the whole band, so navigation never depends on
  JavaScript and crawlers follow it normally

Switching a band to `OVERLAY` renders the title, subtitle and CTA over the
photo instead, with position (5 options), light/dark type and overlay strength
all controllable.

---

## Product rails

A band can show a compact carousel beneath it (`showProductRail`), sourced from
`new`, `bestseller`, `sale`, `featured`, or any category slug. Rails are
deliberately secondary — small type, tight rhythm, no competing headline — so
the photography stays dominant.

---

## Links

Every band links to a real route. `href` is validated as an internal path, so
the admin cannot be used as an open redirect.

| Band | Route |
|---|---|
| Fresh Arrivals | `/shop?collection=fresh-arrivals` |
| Best Sellers | `/shop?collection=best-sellers` |
| Sale | `/shop?collection=sale` |
| Shirts / Polos / Jackets / Hoodies / T-Shirts / Bottoms / Kurtas | `/category/<slug>` |

`?collection=` is a curated filter backed by product flags (`isNewArrival`,
`isBestSeller`, a set `compareAtPrice`) rather than a category, so the listing
matches exactly what the homepage rail showed. The shop page titles itself
accordingly — "Fresh Arrivals", not "Shop all".

A band whose category has no stock **and** no live campaign band is dropped
from the header, so navigation never points somewhere empty and unadvertised.
A category being promoted on the homepage earns its header slot immediately,
even before the first unit is merchandised.

---

## The header over the artwork

On the homepage the header starts fully transparent so the photography runs
edge to edge behind it, and `<main>` is pulled up by exactly the header's
height. The moment the page scrolls it takes on a blurred background — which is
what keeps it readable over unpredictable photographs, rather than hoping every
image is dark enough.

Its contrast comes from the leading band's `theme`: CULT's artwork is bright,
so `DARK` gives ink type. Light type would vanish into that sky.

The centred wordmark fades out while transparent, because the campaign artwork
carries its own CULT lockup and the two would otherwise stack. It returns the
instant the page scrolls, and the link stays reachable throughout.

---

## Adding a band

1. Drop `<key>-desktop.png` and `<key>-mobile.png` into `assets/`
2. `npm run import:home-art`
3. Check order, link and focal point in **Admin → Homepage**

Or create it entirely in the admin: **New section** → upload both crops → set
key, title, link and CTA → drag into place.

Bands with no artwork on disk render a labelled placeholder naming the exact
file paths expected, so an unfinished homepage is self-documenting rather than
silently blank. They are switched off by default.

---

## Performance

- Only the first band loads eagerly (`priority`); every other is lazy
- Desktop and mobile crops are `md:hidden` / `hidden md:block`, so a phone
  never downloads the 2400px landscape file
- Artwork is pre-compressed to WebP, then served through `next/image` with
  AVIF/WebP negotiation
- The page is a server component and revalidates every 300s
- Motion is one short fade-and-rise per band, and `prefers-reduced-motion`
  removes it entirely rather than merely speeding it up
