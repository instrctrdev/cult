-- Add the two supplied reels to the homepage editor. Keep existing editor reels
-- in their current order after the launch reel.
UPDATE `HomepageReel` SET `position` = `position` + 2 WHERE `position` >= 1;

INSERT IGNORE INTO `HomepageReel`
  (`id`, `title`, `videoUrl`, `posterUrl`, `position`, `isActive`, `updatedAt`)
SELECT 'cult-reel-2', 'Embroidered shirts', '/videos/cult-reel-2.mp4',
  '/images/home/cult-reel-2-poster.jpg', 1, true, CURRENT_TIMESTAMP(3)
FROM DUAL
WHERE (
  SELECT COUNT(*) FROM `Product`
  WHERE `status` = 'ACTIVE' AND `deletedAt` IS NULL
    AND `publishedAt` IS NOT NULL AND `publishedAt` <= CURRENT_TIMESTAMP(3)
) >= 5;

INSERT IGNORE INTO `HomepageReel`
  (`id`, `title`, `videoUrl`, `posterUrl`, `position`, `isActive`, `updatedAt`)
SELECT 'cult-reel-3', 'The everyday fit', '/videos/cult-reel-3.mp4',
  '/images/home/cult-reel-3-poster.jpg', 2, true, CURRENT_TIMESTAMP(3)
FROM DUAL
WHERE (
  SELECT COUNT(*) FROM `Product`
  WHERE `status` = 'ACTIVE' AND `deletedAt` IS NULL
    AND `publishedAt` IS NOT NULL AND `publishedAt` <= CURRENT_TIMESTAMP(3)
) >= 5;

-- Each reel needs five live products to appear. Prefer related catalog pieces;
-- use the remaining published products as fallback when a preferred item is
-- unavailable in another environment. Editors can change these tags in Admin.
INSERT IGNORE INTO `HomepageReelProduct` (`reelId`, `productId`, `position`)
SELECT reel.`id`, ranked.`id`, ranked.`rank` - 1
FROM (
  SELECT `id`, ROW_NUMBER() OVER (
    ORDER BY CASE `slug`
      WHEN 'blue-checks' THEN 0
      WHEN 'blue-mist-stripe-shirt' THEN 1
      WHEN 'sunflower-stripe-shirt' THEN 2
      WHEN 'bloom-hem-overshirt' THEN 3
      WHEN 'contour-knit-polo' THEN 4
      ELSE 100 END,
      `isTrending` DESC, `isBestSeller` DESC, `position` ASC, `id` ASC
  ) AS `rank`
  FROM `Product`
  WHERE `status` = 'ACTIVE' AND `deletedAt` IS NULL
    AND `publishedAt` IS NOT NULL AND `publishedAt` <= CURRENT_TIMESTAMP(3)
) AS ranked
JOIN `HomepageReel` AS reel ON reel.`id` = 'cult-reel-2'
WHERE ranked.`rank` <= 5;

INSERT IGNORE INTO `HomepageReelProduct` (`reelId`, `productId`, `position`)
SELECT reel.`id`, ranked.`id`, ranked.`rank` - 1
FROM (
  SELECT `id`, ROW_NUMBER() OVER (
    ORDER BY CASE `slug`
      WHEN 'blue-mist-stripe-shirt' THEN 0
      WHEN 'utility-pleat-cargo' THEN 1
      WHEN 'bloom-hem-overshirt' THEN 2
      WHEN 'weekend-contrast-set' THEN 3
      WHEN 'script-sleeve-henley' THEN 4
      ELSE 100 END,
      `isTrending` DESC, `isBestSeller` DESC, `position` ASC, `id` ASC
  ) AS `rank`
  FROM `Product`
  WHERE `status` = 'ACTIVE' AND `deletedAt` IS NULL
    AND `publishedAt` IS NOT NULL AND `publishedAt` <= CURRENT_TIMESTAMP(3)
) AS ranked
JOIN `HomepageReel` AS reel ON reel.`id` = 'cult-reel-3'
WHERE ranked.`rank` <= 5;
