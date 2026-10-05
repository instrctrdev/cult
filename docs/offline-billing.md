# Offline billing and printer setup

Offline billing is at **Admin → Offline billing**. Each completed sale is stored separately from online orders, and its items reduce the same variant inventory used by online checkout. Staff must be connected to the site to bill; this is not an offline queue.

## First use

1. Deploy the database migration `20261005000000_offline_sales` with `npm run db:deploy` before starting the new app build. The normal production build script runs migrations automatically.
2. In **Admin → Settings**, fill in the store's legal name, address, phone and GSTIN as applicable. Check that product variant SKUs and stock are correct.
3. Open a saved product and choose **Generate / print labels**. Select a variant, set the number of copies, and print. The Code 128 barcode encodes the exact SKU. MRP uses the variant compare-at price when present, otherwise its selling price.
4. Connect the Shreyans P58D label printer and TVS RP 3230 receipt printer to the **cashier's computer** by USB. Install the [Shreyans 58D label driver](https://www.shreyanspos.com/pages/psf58d) and the matching [TVS RP 3230 driver](https://www.tvs-e.in/product-support/) for that computer's operating system. Print a test page from the operating system before using this site.
5. In the browser print dialog, choose the installed printer. For the P58D labels set 50 × 30 mm media, actual/100% scale, no margins, and turn off browser headers and footers. For the TVS receipt use the width of the roll actually loaded (typically 80 mm) and the same scale/header settings. Save each printer's preset in the operating system or browser if supported.
6. Pair a barcode scanner in USB HID/keyboard mode. Place the cursor in **Scan barcode or enter SKU**; a scanner that sends Enter after the scan adds the exact variant automatically. Test with one label before printing in bulk.

## Sale flow

Scan or search, adjust quantity, enter an optional customer name/phone, coupon code and additional discount, then select cash or card. **Calculate total** checks stock and coupon rules and shows both discounts separately. Take the cash or confirm the card terminal transaction, then select **Payment received — complete sale**. The saved receipt can be reprinted from Recent offline sales.

Card payments are recorded as confirmed by the cashier. The site does not connect to a card terminal or process the card; never type card numbers into the site. A browser can print to printers installed on the cashier's computer, but the hosted server cannot pair a physical printer remotely or silently select a local device. Browser printer selection is required unless the cashier computer has a managed kiosk print setup.

Coupons with customer usage limits require a phone number. First-order, account-only and free-shipping coupons are unavailable for walk-in sales. Cashier discounts are recorded separately from coupon discounts. Receipt totals are recomputed on completion and inventory is decremented atomically, so a concurrent online checkout cannot sell the same available unit.

Offline receipts show recorded selling prices and discounts. This flow does not calculate GST or replace an accountant-approved tax invoice format. Configure tax treatment and statutory invoice fields before using it where a tax invoice is required.
