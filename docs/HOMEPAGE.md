# Homepage

The CULT homepage uses a dark editorial layout:

1. A first-visit animation reveals “Your wardrobe's next obsession” and the CULT Clothing mark. It plays once per browser session and supports reduced motion.
2. One Admin-controlled hero: a silent looping video or a responsive offer image. The `hero` homepage record supplies its media and shop link.
3. A swipeable bestsellers rail using live product images and prices.
4. Three starter category features, editable in Admin, with more cards available as needed.
5. The auto-rotating, swipeable five-product “Trending right now” carousel. Products are selected with the Trending option in Admin.
6. A shoppable reels rail. Each reel has a video, optional poster and five linked products in an expandable bubble.

The existing announcement bar, header, category navigation and footer remain in the storefront shell. On mobile, category features stack and both product and reel rails scroll horizontally.

## Artwork and content

The default hero uses `public/images/home/cult-hero-desktop.jpg` and `public/images/home/cult-hero-mobile.jpg`. The live `hero` record can replace those images or add a video. Set its wording mode to “In the image” for an offer banner with lettering already in the artwork.

In Admin → Homepage, upload a desktop hero at 1920 × 1080 px and a mobile hero at 1080 × 1920 px. The video control accepts MP4 or WebM and uses the responsive images as fallback. Only the `hero` record is rendered; older campaign records remain accessible in the archived section.

Category features use separate desktop and mobile crops. Recommended dimensions are 1600 × 675 px and 1080 × 456 px. The three initial cards reuse existing CULT artwork until an editor replaces it. Reel videos should be 1080 × 1920 px (9:16), with an optional poster of the same dimensions. Reels appear after the first one is uploaded and saved with five published products.

Best sellers come from the live product flag. If no bestsellers are available, the rail shows links to three collections without invented product names or prices. If the database is temporarily unavailable, the static hero still renders.

The storefront palette is defined in `src/app/globals.css` and mirrored in `src/lib/brand.ts`. The admin UI follows the same dark palette; printable receipts, labels and documents retain a white paper background.
