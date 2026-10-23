# Homepage

The CULT homepage uses a dark editorial layout:

1. Full-screen campaign hero with the CULT wordmark and a shop link.
2. Three image-led collection panels for Polos, Shirts and T-Shirts.
3. A swipeable bestsellers rail using live product images and prices.
4. An auto-rotating, swipeable five-product "Trending right now" carousel. Products are selected with the Trending option in Admin.

The existing announcement bar, header, category navigation and footer remain in the storefront shell. On mobile, the three collection panels stack and the product rail scrolls horizontally.

## Artwork and content

The default hero uses `public/images/home/cult-hero-desktop.jpg` and `public/images/home/cult-hero-mobile.jpg`. The collection panels use the CULT images in `public/images/cult/`.

The hero can use an active Admin → Homepage section when its desktop image path contains `/cult/` or `/home/cult-`. This keeps legacy imported campaign images with another brand's lettering out of the CULT hero. The section's desktop and mobile focal positions still apply. Other homepage sections are not rendered by this layout.

Best sellers come from the live product flag. If no bestsellers are available, the rail shows links to the three featured collections without invented product names or prices. If the database is temporarily unavailable, the static campaign and collection sections still render.

The storefront palette is defined in `src/app/globals.css` and mirrored in `src/lib/brand.ts`. The admin UI follows the same dark palette; printable receipts, labels and documents retain a white paper background.
