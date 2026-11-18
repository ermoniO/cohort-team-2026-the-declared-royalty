-- What the bill is for, as written on it (e.g. "Monthly water usage and sewer service").
-- Optional: older invoices and fresh uploads don't have one until it's extracted or entered.
ALTER TABLE invoices ADD COLUMN description VARCHAR(500);
