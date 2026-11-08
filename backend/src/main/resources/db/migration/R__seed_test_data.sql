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
DELETE FROM vendor_categories;
DELETE FROM property_categories;

-- 2. Seed Property Categories
INSERT INTO property_categories (category_code, name, description) VALUES
('COMMERCIAL_OFFICE', 'Commercial Office Tower', 'Multi-tenant high-rise and corporate office properties'),
('RETAIL_PLAZA', 'Retail Plaza & Shopping Center', 'Open-air strip centers, grocery-anchored plazas, and regional retail'),
('INDUSTRIAL_PARK', 'Industrial Logistics Hub', 'Distribution warehouses, flex facilities, and manufacturing parks'),
('MEDICAL_CENTER', 'Medical Center Pavilion', 'Healthcare clinics, surgical centers, and outpatient medical buildings');

-- 3. Seed Vendor Categories
INSERT INTO vendor_categories (category_code, name, description) VALUES
('UTILITIES_ENERGY', 'Utilities & Energy Management', 'Electric, water, gas, solar, and utility monitoring'),
('HVAC_MECHANICAL', 'HVAC & Mechanical Systems', 'Heating, cooling, boilers, chillers, and preventative HVAC maintenance'),
('JANITORIAL_CLEANING', 'Janitorial & Cleaning Services', 'Commercial daily office cleaning, trash removal, and sanitization'),
('FIRE_LIFE_SAFETY', 'Fire & Life Safety Systems', 'Fire alarms, sprinkler inspections, extinguishers, and emergency lighting'),
('SECURITY_ACCESS', 'Security & Access Control', 'Physical security, keycard access controls, and video surveillance'),
('ELEVATOR_VERTICAL', 'Elevator & Vertical Transport', 'Elevator inspections, maintenance contracts, and cab servicing'),
('LANDSCAPING_GROUNDS', 'Landscaping & Grounds Care', 'Groundskeeping, irrigation, snow removal, and exterior maintenance'),
('GENERAL_MAINTENANCE', 'General Facility Maintenance', 'Handyman, lock repair, painting, drywall, and structural maintenance');

-- 4. Seed Meaningful Properties (PostgreSQL generates property_uuid)
INSERT INTO properties (name, category, address, status) VALUES
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

-- 5. Seed Meaningful Vendors (PostgreSQL generates vendor_uuid)
INSERT INTO vendors (vendor_name, category, tax_id, billing_phone_number, payment_method, status) VALUES
('Apex Utilities & HVAC', 'UTILITIES_ENERGY', '12-3456789', '555-0192', 'ACH', 'ACTIVE'),
('Beacon Fire & Life Safety', 'FIRE_LIFE_SAFETY', '98-7654321', '555-0144', 'CHECK', 'ACTIVE'),
('Cornerstone Commercial Janitorial', 'JANITORIAL_CLEANING', '45-6789012', '555-0188', 'CREDIT_CARD', 'ACTIVE');

-- 6. Map Vendor to Property dynamically (PostgreSQL generates mapping_uuid)
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

-- 7. Seed Initial Test Invoice dynamically (PostgreSQL generates invoice_uuid)
INSERT INTO invoices (mapping_uuid, vendor_supplied_invoice_id, amount, invoice_status)
SELECT 
    m.mapping_uuid,
    'INV-2026-001',
    4500.00,
    'INGESTED'
FROM property_vendor_mapping m
WHERE m.vendor_account_number = 'ACT-9483920';
