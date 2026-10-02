-- Payment.provider now defaults to "cashfree" (was "fastrr"), matching the
-- switch of the active payment gateway. Existing rows are untouched; this
-- only changes what new rows get if the application ever inserts one without
-- specifying a provider explicitly (it always does specify one in practice).
ALTER TABLE `Payment` MODIFY `provider` VARCHAR(50) NOT NULL DEFAULT 'cashfree';
