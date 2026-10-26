ALTER TABLE `HomepageSection`
  ADD COLUMN `mobileVideoUrl` VARCHAR(512) NULL;

-- The supplied 16:9 and 9:16 clips replace the previous portrait reel hero.
-- The reel below Trending retains its own video and poster.
UPDATE `HomepageSection`
SET `videoUrl` = '/videos/cult-hero-desktop.mp4',
    `mobileVideoUrl` = '/videos/cult-hero-mobile.mp4',
    `desktopImage` = NULL,
    `mobileImage` = NULL,
    `textMode` = 'IMAGE',
    `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `key` = 'hero';
