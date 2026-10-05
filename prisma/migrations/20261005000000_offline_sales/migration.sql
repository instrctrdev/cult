CREATE TABLE `OfflineSale` (
  `id` VARCHAR(191) NOT NULL, `receiptNumber` VARCHAR(40) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL, `customerName` VARCHAR(150) NULL,
  `customerPhone` VARCHAR(32) NULL, `paymentMethod` ENUM('CASH','CARD') NOT NULL,
  `subtotal` DECIMAL(10,2) NOT NULL, `couponCode` VARCHAR(64) NULL,
  `couponDiscount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `manualDiscount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `roundOff` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `grandTotal` DECIMAL(10,2) NOT NULL, `couponId` VARCHAR(191) NULL,
  `cashierId` VARCHAR(191) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `OfflineSale_receiptNumber_key` (`receiptNumber`),
  UNIQUE INDEX `OfflineSale_idempotencyKey_key` (`idempotencyKey`),
  INDEX `OfflineSale_createdAt_idx` (`createdAt`),
  INDEX `OfflineSale_couponId_idx` (`couponId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OfflineSaleItem` (
  `id` VARCHAR(191) NOT NULL, `saleId` VARCHAR(191) NOT NULL,
  `variantId` VARCHAR(191) NULL, `sku` VARCHAR(100) NOT NULL,
  `productName` VARCHAR(255) NOT NULL, `variantLabel` VARCHAR(150) NULL,
  `brand` VARCHAR(100) NOT NULL, `unitPrice` DECIMAL(10,2) NOT NULL,
  `mrp` DECIMAL(10,2) NOT NULL, `quantity` INTEGER NOT NULL,
  `lineTotal` DECIMAL(10,2) NOT NULL,
  INDEX `OfflineSaleItem_saleId_idx` (`saleId`),
  INDEX `OfflineSaleItem_variantId_idx` (`variantId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OfflineSaleItem` ADD CONSTRAINT `OfflineSaleItem_saleId_fkey`
  FOREIGN KEY (`saleId`) REFERENCES `OfflineSale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `OfflineSaleItem` ADD CONSTRAINT `OfflineSaleItem_variantId_fkey`
  FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
