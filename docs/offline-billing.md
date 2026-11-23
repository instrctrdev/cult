# Offline billing and printer setup

Offline billing is at **Admin → Offline billing**. Each completed sale is stored separately from online orders, and its items reduce the same variant inventory used by online checkout. Staff must be connected to the site to bill; this is not an offline queue.

## First use

1. Deploy the database migration `20261005000000_offline_sales` with `npm run db:deploy` before starting the new app build. The normal production build script runs migrations automatically.
2. In **Admin → Settings**, fill in the store's legal name, address, phone and GSTIN as applicable. Check that product variant SKUs and stock are correct.
3. Open a saved product and choose **Generate / print labels**. Select a variant, set the number of copies, and print. The Code 128 barcode encodes the exact SKU. MRP uses the variant compare-at price when present, otherwise its selling price.
4. Pair the Shreyans P58D in **Windows Settings → Bluetooth & devices** and install its driver. Open the label page in current desktop Chrome over HTTPS, click **Add printer**, and select the paired P58D in Chrome's secure chooser. The approved printer then appears in the admin panel, where it can be selected and refreshed. Chrome does not expose the friendly Bluetooth device name to the site, so the panel labels approved devices as P58D / Bluetooth SPP 1, 2, and so on.
5. For direct Bluetooth printing, select the authorized printer in Admin and use **Print by Bluetooth**. The label artwork uses the full 40 × 25 mm canvas, with a 1 mm safety margin and a separate readable SKU line. As a fallback, use the browser print dialog: choose the installed printer, set 40 × 25 mm media, choose **Portrait**, use actual/100% scale and no margins, and disable headers and footers. Do not choose Landscape: the P58D driver swaps the dimensions and makes one page cross two stickers. For the TVS receipt use its installed USB driver and the roll width actually loaded, normally 80 mm.
6. Pair a barcode scanner in USB HID/keyboard mode. Place the cursor in **Scan barcode or enter SKU**; a scanner that sends Enter after the scan adds the exact variant automatically. Test with one label before printing in bulk.

## Sale flow

Scan or search, adjust quantity, then enter the customer's mobile number first. After four digits, matching previous customers appear; entering an exact ten-digit number fills the saved name automatically. Choosing a suggestion fills both fields. Staff can edit the name, and changing the phone clears the prior name. Customer lookup requires billing permission and is never publicly cached.

Choose either a fixed rupee discount or a percentage discount, then select cash or card. The coupon field is removed from new billing; historical coupon receipts remain readable. The server calculates and checks the discount and stock before payment. Discounts cannot exceed the subtotal or combine both modes. Take the cash or confirm the card terminal transaction, then select **Payment received — complete sale**. The saved receipt records and displays the discount amount and its mode.

Sales history supports Today, Last 7 days, This month, or Custom dates, plus search by receipt/customer/phone, payment method, and cashier. Custom dates include the full final day in India time. Totals and pagination use the same filters.

Card payments are recorded as confirmed by the cashier. The site does not connect to a card terminal or process the card; never type card numbers into the site. A browser can print to printers installed on the cashier's computer, but the hosted server cannot pair a physical printer remotely or silently select a local device. Browser printer selection is required unless the cashier computer has a managed kiosk print setup.

Receipt totals are recomputed on completion and inventory is decremented atomically, so a concurrent online checkout cannot sell the same available unit. Offline sales and online checkout share the variant's Inventory record and ledger. Admin inventory adjustments update this same record. Product listing, detail, and search API responses use `no-store` so stock is not served from a stale shared HTTP cache. Open product buy boxes refresh on tab focus and every 30 seconds; server-side checkout still checks stock immediately. A sale is not a stock purchase/restock: incoming stock must be added through Admin → Inventory.

Offline receipts show recorded selling prices and discounts. This flow does not calculate GST or replace an accountant-approved tax invoice format. Configure tax treatment and statutory invoice fields before using it where a tax invoice is required.
