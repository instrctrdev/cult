ALTER TABLE `OfflineSale`
  ADD COLUMN `manualDiscountPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE `OfflineSaleItem`
  ADD COLUMN `imageUrl` VARCHAR(512) NULL;
