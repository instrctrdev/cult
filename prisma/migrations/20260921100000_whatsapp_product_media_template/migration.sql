INSERT INTO `Setting` (`key`, `value`, `type`, `group`, `updatedAt`)
VALUES ('whatsapp.product_view_template', 'product_view_reminder_new', 'string', 'whatsapp', CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  `value` = 'product_view_reminder_new',
  `type` = 'string',
  `group` = 'whatsapp',
  `updatedAt` = CURRENT_TIMESTAMP(3);
