-- The previous rollback removed this column, so add it again for responsive
-- hero videos selected in Admin.
ALTER TABLE `HomepageSection`
  ADD COLUMN `mobileVideoUrl` VARCHAR(512) NULL;

-- Use the two clips supplied in this project's assets folder for the single
-- hero. The Instagram reel below Trending remains independent.
UPDATE `HomepageSection`
SET `videoUrl` = '/videos/cult-hero-desktop.mp4',
    `mobileVideoUrl` = '/videos/cult-hero-mobile.mp4',
    `desktopImage` = NULL,
    `mobileImage` = NULL,
    `textMode` = 'IMAGE',
    `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `key` = 'hero';
