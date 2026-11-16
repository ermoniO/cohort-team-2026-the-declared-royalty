-- Repeatable: Flyway re-runs this file whenever it changes, so every statement must be safe to run again.

-- 1. The property: Industrial Business Park from V2. This file used to insert a second copy at the
--    same address (11111111-...-111111111111), which made the address ambiguous for matching bills
--    to properties. Point anything still using the copy at V2's property, then remove the copy.
UPDATE property_vendor_mapping
SET property_uuid = '11111111-1111-1111-1111-111111111101'
WHERE property_uuid = '11111111-1111-1111-1111-111111111111';

DELETE FROM properties
WHERE property_uuid = '11111111-1111-1111-1111-111111111111'
  AND NOT EXISTS (SELECT 1 FROM property_vendor_mapping WHERE property_uuid = '11111111-1111-1111-1111-111111111111');

-- 2. Seed a Mock Vendor
INSERT INTO vendors (vendor_uuid, vendor_name, billing_phone_number, status, payment_method)
VALUES ('22222222-2222-2222-2222-222222222222', 'Apex Utilities', '555-0192', 'ACTIVE', 'ACH')
ON CONFLICT DO NOTHING;

-- 3. Map Vendor to Property (Creates the required mapping_uuid record)
INSERT INTO property_vendor_mapping (mapping_uuid, vendor_uuid, property_uuid, vendor_account_number, status, auto_approval_enabled)
VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111101', 'ACT-9483920', 'ACTIVE', FALSE)
ON CONFLICT DO NOTHING;

-- 4. Seed a Dummy Invoice for your Audit Log Tests
INSERT INTO invoices (invoice_uuid, vendor_supplied_invoice_id, mapping_uuid, amount, invoice_status)
VALUES ('99999999-9999-9999-9999-999999999999', 'INV-2026-001', '33333333-3333-3333-3333-333333333333', 4500.00, 'INGESTED')
ON CONFLICT DO NOTHING;
