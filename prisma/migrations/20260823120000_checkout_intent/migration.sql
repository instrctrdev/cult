-- CreateTable
CREATE TABLE `CheckoutIntent` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `lines` JSON NOT NULL,
    `couponCode` VARCHAR(64) NULL,
    `cartId` VARCHAR(191) NULL,
    `amountPaise` INTEGER NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CheckoutIntent_reference_key`(`reference`),
    UNIQUE INDEX `CheckoutIntent_idempotencyKey_key`(`idempotencyKey`),
    UNIQUE INDEX `CheckoutIntent_orderId_key`(`orderId`),
    INDEX `CheckoutIntent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
