# Homepage

The CULT homepage uses a dark editorial layout:

1. A first-visit animation reveals “Your wardrobe's next obsession” and the CULT Clothing mark. It plays once per browser session and supports reduced motion.
2. One silent looping hero video. The `hero` homepage record supplies its clip, responsive loading posters and shop link.
3. A swipeable bestsellers rail using live product images and prices.
4. Three starter category features, editable in Admin, with more cards available as needed.
5. The auto-rotating, swipeable five-product “Trending right now” carousel. Products are selected with the Trending option in Admin.
6. A shoppable reels rail. Each reel has a video, optional poster and five linked products in an expandable bubble.

The existing announcement bar, header, category navigation and footer remain in the storefront shell. On mobile, category features stack and both product and reel rails scroll horizontally.

## Artwork and content

The default hero uses the supplied CULT Instagram reel saved at `public/videos/cult-launch-reel.mp4`. Desktop and mobile images are fallback posters; the video remains the visible hero when it plays. The Admin form can replace the clip without another deploy.

In Admin → Homepage, upload a desktop hero at 1920 × 1080 px and a mobile hero at 1080 × 1920 px. The video control accepts MP4 or WebM and uses the responsive images as fallback. Only the `hero` record is rendered; older campaign records remain accessible in the archived section.

Category features use separate desktop and mobile crops. Recommended dimensions are 1600 × 675 px and 1080 × 456 px. The three initial cards reuse existing CULT artwork until an editor replaces it. Reel videos should be 1080 × 1920 px (9:16), with an optional poster of the same dimensions. The supplied CULT reel is placed below Trending and linked to five published products, preferring Trending selections. Further reels can be uploaded through Admin → Homepage.

Best sellers come from the live product flag. If no bestsellers are available, the rail shows links to three collections without invented product names or prices. If the database is temporarily unavailable, the static hero still renders.

The storefront palette is defined in `src/app/globals.css` and mirrored in `src/lib/brand.ts`. The admin UI follows the same dark palette; printable receipts, labels and documents retain a white paper background.
