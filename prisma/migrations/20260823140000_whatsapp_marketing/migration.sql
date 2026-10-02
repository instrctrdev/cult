-- AlterTable
ALTER TABLE `User` ADD COLUMN `whatsappOptIn` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `whatsappOptInAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `CustomerEvent` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `guestToken` VARCHAR(191) NULL,
    `eventType` ENUM('PRODUCT_VIEW', 'ADD_TO_CART', 'CHECKOUT_STARTED', 'PURCHASE') NOT NULL,
    `productId` VARCHAR(191) NULL,
    `cartId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerEvent_eventType_processedAt_createdAt_idx`(`eventType`, `processedAt`, `createdAt`),
    INDEX `CustomerEvent_userId_eventType_productId_createdAt_idx`(`userId`, `eventType`, `productId`, `createdAt`),
    INDEX `CustomerEvent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WhatsAppMessageLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `phone` VARCHAR(32) NOT NULL,
    `automation` VARCHAR(64) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `cartId` VARCHAR(191) NULL,
    `templateName` VARCHAR(128) NOT NULL,
    `metaMessageId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `errorMessage` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `readAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WhatsAppMessageLog_metaMessageId_key`(`metaMessageId`),
    INDEX `WhatsAppMessageLog_userId_automation_productId_createdAt_idx`(`userId`, `automation`, `productId`, `createdAt`),
    INDEX `WhatsAppMessageLog_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `WhatsAppMessageLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CustomerEvent` ADD CONSTRAINT `CustomerEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerEvent` ADD CONSTRAINT `CustomerEvent_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WhatsAppMessageLog` ADD CONSTRAINT `WhatsAppMessageLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WhatsAppMessageLog` ADD CONSTRAINT `WhatsAppMessageLog_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
