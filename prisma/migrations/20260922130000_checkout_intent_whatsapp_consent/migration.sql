ALTER TABLE `CheckoutIntent`
    ADD COLUMN `whatsappOptIn` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `guestTokens` JSON NULL;
