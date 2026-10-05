INSERT IGNORE INTO `Banner`
  (`id`, `title`, `placement`, `position`, `isActive`, `createdAt`, `updatedAt`)
VALUES
  ('announcement-prepaid-5', 'GET 5% OFF ON PREPAID!', 'ANNOUNCEMENT', 0, 1, NOW(3), NOW(3)),
  ('announcement-delivery-2-5', 'GET DELIVERY IN 2-5 WORKING DAYS', 'ANNOUNCEMENT', 1, 1, NOW(3), NOW(3)),
  ('announcement-buy-2', 'BUY ANY 2 GET 10% OFF', 'ANNOUNCEMENT', 2, 1, NOW(3), NOW(3)),
  ('announcement-buy-3', 'BUY ANY 3 GET 15% OFF', 'ANNOUNCEMENT', 3, 1, NOW(3), NOW(3)),
  ('announcement-buy-4', 'BUY ANY 4 GET 20% OFF', 'ANNOUNCEMENT', 4, 1, NOW(3), NOW(3));
