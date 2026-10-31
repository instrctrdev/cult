# Homepage

The CULT homepage uses a dark editorial layout:

1. A first-visit black intro reveals the CULT Clothing mark with a light sweep, then the “Dress like you mean it” line. It plays once per browser session and supports reduced motion.
2. A black streetwear hero with separate desktop and mobile poster artwork and a shop link from the `hero` homepage record.
3. Four compact category cards for T-Shirts, Collections, Caps and New Arrivals.
4. A light Fresh Drops editorial feature linking to the new-arrival collection.
5. A swipeable bestsellers rail using live product images and prices.
6. The auto-rotating, swipeable five-product “Trending right now” carousel on a light background. Products are selected with the Trending option in Admin.
7. A “Shop From Reels” rail. The product bubble expands five linked products on each card. Opening a reel starts a full-screen player; swipe up or down on mobile, or use the mouse wheel or arrow controls on desktop, to move between reels. The tagged products scroll horizontally at the bottom and can be added to the cart after selecting a variant when needed.

The existing announcement bar, header, category navigation and footer remain in the storefront shell. On mobile, the category cards and both product and reel rails scroll horizontally.

## Artwork and content

The hero uses `public/images/cult/hero-poster-desktop.webp` and `public/images/cult/hero-poster-mobile.webp`. Editorial typography, inset crops and faint background lettering are part of each image. Only the Explore Collection button is rendered over it; an accessible heading describes the poster to screen readers. The earlier hero videos remain in the repository, and the Instagram reel remains in the shoppable reel rail below Trending.

In Admin → Homepage, the `hero` record supplies the shop link. Its media fields are archived while this fixed artwork is in use. Older campaign records remain accessible in the archived section.

The category cards and Fresh Drops feature use CULT artwork in `public/images/cult/`. Fresh Drops uses one compact, faded photo backdrop behind its copy at every screen size. The T-Shirts and Caps cards use generated editorial images. The earlier Admin category promo records are retained for reference but are not rendered by this homepage layout. Reel videos should be vertical (9:16), with an optional poster of the same proportions. The launch reel and the supplied `reel2` and `reel3` clips appear below Trending in smaller cards. Each has five published products tagged in the homepage editor; the new clips prefer related shirts and styling pieces. Further reels and tags can be managed through Admin → Homepage.

Best sellers come from the live product flag. If no bestsellers are available, the rail shows links to three collections without invented product names or prices. If the database is temporarily unavailable, the static hero still renders.

The storefront palette is defined in `src/app/globals.css` and mirrored in `src/lib/brand.ts`. The admin UI follows the same dark palette; printable receipts, labels and documents retain a white paper background.
