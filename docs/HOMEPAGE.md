# Homepage

The CULT homepage uses a dark editorial layout:

1. A first-visit animation reveals “Your wardrobe's next obsession” and the CULT Clothing mark. It plays once per browser session and supports reduced motion.
2. One silent looping hero video with separate desktop and mobile files. The `hero` homepage record supplies both clips and the shop link.
3. A swipeable bestsellers rail using live product images and prices.
4. Three starter category features, editable in Admin, with more cards available as needed.
5. The auto-rotating, swipeable five-product “Trending right now” carousel. Products are selected with the Trending option in Admin.
6. A shoppable reels rail. Each reel has a video, optional poster and five linked products in an expandable bubble.

The existing announcement bar, header, category navigation and footer remain in the storefront shell. On mobile, category features stack and both product and reel rails scroll horizontally.

## Artwork and content

The default hero uses the supplied landscape and portrait videos at `public/videos/cult-hero-desktop.mp4` and `public/videos/cult-hero-mobile.mp4`. The earlier Instagram reel remains in the shoppable reel rail below Trending. Hero videos cover their frames, and the old image posters are not layered behind them. The Admin form can replace either clip without another deploy.

In Admin → Homepage, upload a desktop hero video at 1920 × 1080 px and a mobile hero video at 1080 × 1920 px. If the mobile video is empty, the desktop video plays on phones. The image fields are used only when no video is set. Only the `hero` record is rendered; older campaign records remain accessible in the archived section.

Category features use separate desktop and mobile crops. Recommended dimensions are 1600 × 675 px and 1080 × 456 px. The three initial cards reuse existing CULT artwork until an editor replaces it. Reel videos should be 1080 × 1920 px (9:16), with an optional poster of the same dimensions. The supplied CULT reel is placed below Trending and linked to five published products, preferring Trending selections. Further reels can be uploaded through Admin → Homepage.

Best sellers come from the live product flag. If no bestsellers are available, the rail shows links to three collections without invented product names or prices. If the database is temporarily unavailable, the static hero still renders.

The storefront palette is defined in `src/app/globals.css` and mirrored in `src/lib/brand.ts`. The admin UI follows the same dark palette; printable receipts, labels and documents retain a white paper background.
