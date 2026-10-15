ALTER TABLE `Coupon`
  ADD COLUMN `offerType` ENUM('STANDARD', 'BUY_X_GET_Y', 'BUNDLE_PRICE') NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN `autoApply` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `buyQuantity` INTEGER NULL,
  ADD COLUMN `getQuantity` INTEGER NULL,
  ADD COLUMN `bundleQuantity` INTEGER NULL,
  ADD COLUMN `minCompletedOrders` INTEGER NULL;

CREATE INDEX `Coupon_autoApply_isActive_expiresAt_idx`
  ON `Coupon`(`autoApply`, `isActive`, `expiresAt`);
