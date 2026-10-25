CREATE TABLE `HomepageCategoryPromo` (
  `id` VARCHAR(191) NOT NULL,
  `eyebrow` VARCHAR(80) NULL,
  `title` VARCHAR(120) NOT NULL,
  `href` VARCHAR(512) NOT NULL,
  `desktopImage` VARCHAR(512) NOT NULL,
  `mobileImage` VARCHAR(512) NULL,
  `imageAlt` VARCHAR(255) NULL,
  `position` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `HomepageCategoryPromo_isActive_position_idx`(`isActive`, `position`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `HomepageReel` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `videoUrl` VARCHAR(512) NOT NULL,
  `posterUrl` VARCHAR(512) NULL,
  `position` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `HomepageReel_isActive_position_idx`(`isActive`, `position`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `HomepageReelProduct` (
  `reelId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `position` INTEGER NOT NULL,
  INDEX `HomepageReelProduct_reelId_position_idx`(`reelId`, `position`),
  INDEX `HomepageReelProduct_productId_idx`(`productId`),
  PRIMARY KEY (`reelId`, `productId`),
  CONSTRAINT `HomepageReelProduct_reelId_fkey` FOREIGN KEY (`reelId`) REFERENCES `HomepageReel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `HomepageReelProduct_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- The three starter cards reuse existing CULT artwork and can be replaced in Admin.
INSERT INTO `HomepageCategoryPromo`
  (`id`, `eyebrow`, `title`, `href`, `desktopImage`, `mobileImage`, `imageAlt`, `position`, `isActive`, `updatedAt`)
VALUES
  ('home-promo-shirts', 'The everyday edit', 'Shirts', '/category/shirts', '/images/cult/hero-sunflower-desktop.jpg', '/images/cult/edit-sunflower-shirt.jpg', 'Model in a CULT sunflower embroidered shirt', 0, true, CURRENT_TIMESTAMP(3)),
  ('home-promo-bottoms', 'Built for movement', 'Bottoms', '/category/bottoms', '/images/cult/home-hero-desktop.jpg', '/images/cult/home-hero-mobile.jpg', 'CULT campaign look with cargo trousers', 1, true, CURRENT_TIMESTAMP(3)),
  ('home-promo-polos', 'Everyday uniform', 'Polos', '/category/polos', '/images/cult/hero-polo-desktop.jpg', '/images/cult/edit-polo.jpg', 'Model in a black CULT textured polo', 2, true, CURRENT_TIMESTAMP(3));
