# Homepage

The CULT homepage uses a dark editorial layout:

1. A first-visit animation reveals “Your wardrobe's next obsession” and the CULT Clothing mark. It plays once per browser session and supports reduced motion.
2. One silent looping hero video with separate desktop and mobile files. The `hero` homepage record supplies both clips and the shop link.
3. Four compact category cards for T-Shirts, Collections, Caps and New Arrivals.
4. A light Fresh Drops editorial feature linking to the new-arrival collection.
5. A swipeable bestsellers rail using live product images and prices.
6. The auto-rotating, swipeable five-product “Trending right now” carousel. Products are selected with the Trending option in Admin.
7. A shoppable reels rail. The product bubble expands a list of five linked products on each card. Tapping the rest of the reel opens a full-screen player with sound and close controls. The tagged products scroll horizontally at the bottom and can be added to the cart after selecting a variant when needed.

The existing announcement bar, header, category navigation and footer remain in the storefront shell. On mobile, the category cards and both product and reel rails scroll horizontally.

## Artwork and content

The default hero uses the supplied landscape and portrait videos at `public/videos/cult-hero-desktop.mp4` and `public/videos/cult-hero-mobile.mp4`. The earlier Instagram reel remains in the shoppable reel rail below Trending. Hero videos cover their frames, and the old image posters are not layered behind them. The Admin form can replace either clip without another deploy.

In Admin → Homepage, upload a desktop hero video at 1920 × 1080 px and a mobile hero video at 1080 × 1920 px. If the mobile video is empty, the desktop video plays on phones. The image fields are used only when no video is set. Only the `hero` record is rendered; older campaign records remain accessible in the archived section.

The category cards and Fresh Drops feature use CULT artwork in `public/images/cult/`. The T-Shirts and Caps cards use generated editorial images. The earlier Admin category promo records are retained for reference but are not rendered by this homepage layout. Reel videos should be 1080 × 1920 px (9:16), with an optional poster of the same dimensions. The supplied CULT reel is placed below Trending and linked to five published products, preferring Trending selections. Further reels can be uploaded through Admin → Homepage.

Best sellers come from the live product flag. If no bestsellers are available, the rail shows links to three collections without invented product names or prices. If the database is temporarily unavailable, the static hero still renders.

The storefront palette is defined in `src/app/globals.css` and mirrored in `src/lib/brand.ts`. The admin UI follows the same dark palette; printable receipts, labels and documents retain a white paper background.
