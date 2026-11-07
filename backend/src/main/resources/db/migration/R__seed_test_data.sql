-- ============================================================================
-- REPEATABLE SEED TEST DATA
-- Clean environment & seed realistic data with DB-generated UUIDs
-- ============================================================================

-- 1. Clean existing seed data (child tables first)
DELETE FROM audit_logs;
DELETE FROM invoices;
DELETE FROM property_vendor_mapping;
DELETE FROM vendors;
DELETE FROM properties;

-- 2. Seed Meaningful Properties (PostgreSQL generates property_uuid)
INSERT INTO properties (name, property_type, address, status) VALUES
(
    'Grandview Office Tower',
    'COMMERCIAL_OFFICE',
    '{"streetAddress": "450 North Michigan Ave", "city": "Chicago", "state": "IL", "zipCode": "60611"}'::jsonb,
    'ACTIVE'
),
(
    'Harborfront Retail Plaza',
    'RETAIL_PLAZA',
    '{"streetAddress": "1200 Pacific Coast Hwy", "city": "Long Beach", "state": "CA", "zipCode": "90802"}'::jsonb,
    'ACTIVE'
),
(
    'Apex Commerce Hub',
    'INDUSTRIAL_PARK',
    '{"streetAddress": "8800 Interstate Parkway", "city": "Dallas", "state": "TX", "zipCode": "75241"}'::jsonb,
    'ACTIVE'
),
(
    'Metro Medical Pavilion',
    'MEDICAL_CENTER',
    '{"streetAddress": "7400 Fannin St", "city": "Houston", "state": "TX", "zipCode": "77054"}'::jsonb,
    'ACTIVE'
);

-- 3. Seed Meaningful Vendors (PostgreSQL generates vendor_uuid)
INSERT INTO vendors (vendor_name, billing_phone_number, payment_method, status) VALUES
('Apex Utilities & HVAC', '555-0192', 'ACH', 'ACTIVE'),
('Beacon Fire & Life Safety', '555-0144', 'CHECK', 'ACTIVE'),
('Cornerstone Commercial Janitorial', '555-0188', 'CREDIT_CARD', 'ACTIVE');

-- 4. Map Vendor to Property dynamically (PostgreSQL generates mapping_uuid)
INSERT INTO property_vendor_mapping (vendor_uuid, property_uuid, vendor_account_number, status, auto_approval_enabled)
SELECT 
    v.vendor_uuid,
    p.property_uuid,
    'ACT-9483920',
    'ACTIVE',
    TRUE
FROM vendors v, properties p
WHERE v.vendor_name = 'Apex Utilities & HVAC'
  AND p.name = 'Grandview Office Tower';

-- 5. Seed Initial Test Invoice dynamically (PostgreSQL generates invoice_uuid)
INSERT INTO invoices (mapping_uuid, vendor_supplied_invoice_id, amount, invoice_status)
SELECT 
    m.mapping_uuid,
    'INV-2026-001',
    4500.00,
    'INGESTED'
FROM property_vendor_mapping m
WHERE m.vendor_account_number = 'ACT-9483920';
