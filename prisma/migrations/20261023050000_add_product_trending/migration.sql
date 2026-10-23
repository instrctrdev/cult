-- Add a dedicated Admin-controlled source for the homepage Trending carousel.
ALTER TABLE `Product`
  ADD COLUMN `isTrending` BOOLEAN NOT NULL DEFAULT false;

-- Give the new carousel five products immediately. Admin can change these
-- selections from each product's Merchandising settings after deployment.
UPDATE `Product`
SET `isTrending` = true
WHERE `id` IN (
  SELECT `id`
  FROM (
    SELECT `id`
    FROM `Product`
    WHERE `deletedAt` IS NULL AND `status` = 'ACTIVE'
    ORDER BY `isFeatured` DESC, `isBestSeller` DESC, `position` ASC, `publishedAt` DESC
    LIMIT 5
  ) AS `initialTrendingProducts`
);

CREATE INDEX `Product_isTrending_idx` ON `Product`(`isTrending`);
