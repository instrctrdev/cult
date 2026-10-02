CREATE TABLE `GuestWhatsAppConsent` (
    `id` VARCHAR(191) NOT NULL,
    `guestToken` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `consentedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GuestWhatsAppConsent_guestToken_key`(`guestToken`),
    INDEX `GuestWhatsAppConsent_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
