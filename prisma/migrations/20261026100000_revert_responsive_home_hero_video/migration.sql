-- Restore the earlier CULT reel hero if the mistaken responsive-video
-- migration set it. Preserve any subsequent Admin selection.
UPDATE `HomepageSection`
SET `videoUrl` = '/videos/cult-launch-reel.mp4',
    `desktopImage` = '/images/cult/home-hero-desktop.jpg',
    `mobileImage` = '/images/cult/home-hero-mobile.jpg',
    `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `key` = 'hero'
  AND `videoUrl` = '/videos/cult-hero-desktop.mp4';

ALTER TABLE `HomepageSection`
  DROP COLUMN `mobileVideoUrl`;
