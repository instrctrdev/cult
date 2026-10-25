-- Use the CULT reel supplied for the homepage hero. The images remain as
-- loading posters and as a fallback when a browser cannot play the clip.
INSERT INTO `HomepageSection`
  (`id`, `key`, `title`, `href`, `desktopImage`, `mobileImage`, `videoUrl`,
   `textMode`, `priority`, `isActive`, `position`, `updatedAt`)
VALUES
  ('cult-video-hero', 'hero', 'CULT Clothing', '/shop',
   '/images/cult/home-hero-desktop.jpg', '/images/cult/home-hero-mobile.jpg',
   '/videos/cult-launch-reel.mp4', 'IMAGE', true, true, 0, CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `href` = VALUES(`href`),
  `desktopImage` = VALUES(`desktopImage`),
  `mobileImage` = VALUES(`mobileImage`),
  `videoUrl` = VALUES(`videoUrl`),
  `textMode` = 'IMAGE',
  `isActive` = true,
  `updatedAt` = CURRENT_TIMESTAMP(3);

-- Put this reel first while preserving the relative order of any reels
-- editors may already have added.
UPDATE `HomepageReel` SET `position` = `position` + 1;

INSERT INTO `HomepageReel`
  (`id`, `title`, `videoUrl`, `posterUrl`, `position`, `isActive`, `updatedAt`)
SELECT
  'cult-launch-reel', 'CULT Clothing / On the move',
  '/videos/cult-launch-reel.mp4', '/images/home/cult-launch-reel-poster.jpg',
  0, true, CURRENT_TIMESTAMP(3)
FROM DUAL
WHERE (
  SELECT COUNT(*) FROM `Product`
  WHERE `status` = 'ACTIVE' AND `deletedAt` IS NULL
    AND `publishedAt` IS NOT NULL AND `publishedAt` <= CURRENT_TIMESTAMP(3)
) >= 5;

-- The bubble links to five current products, preferring the Admin-selected
-- Trending products. A later Admin edit can replace any of these links.
INSERT INTO `HomepageReelProduct` (`reelId`, `productId`, `position`)
SELECT 'cult-launch-reel', ranked.`id`, ranked.`rank` - 1
FROM (
  SELECT `id`, ROW_NUMBER() OVER (
    ORDER BY `isTrending` DESC, `isBestSeller` DESC,
      `position` ASC, `publishedAt` DESC, `id` ASC
  ) AS `rank`
  FROM `Product`
  WHERE `status` = 'ACTIVE' AND `deletedAt` IS NULL
    AND `publishedAt` IS NOT NULL AND `publishedAt` <= CURRENT_TIMESTAMP(3)
) AS ranked
JOIN `HomepageReel` AS reel ON reel.`id` = 'cult-launch-reel'
WHERE ranked.`rank` <= 5;
