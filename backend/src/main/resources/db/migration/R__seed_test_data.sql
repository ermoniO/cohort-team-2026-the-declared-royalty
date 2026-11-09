-- ============================================================================
-- REPEATABLE SEED TEST DATA
-- Clean environment & seed realistic data with DB-generated UUIDs
-- ============================================================================

-- 1. Clean existing seed data (child tables first)
DELETE FROM property_user_policies;
DELETE FROM audit_logs;
DELETE FROM invoices;
DELETE FROM property_vendor_mapping;
DELETE FROM property_gl_accounts;
DELETE FROM vendors;
DELETE FROM properties;
DELETE FROM payment_methods;
DELETE FROM vendor_categories;
DELETE FROM property_categories;
DELETE FROM users WHERE email != 'system@invoice-automation.local';

-- 2. Seed Property Categories
INSERT INTO property_categories (category_code, name, description, status) VALUES
('COMMERCIAL_OFFICE', 'Commercial Office Tower', 'Multi-tenant high-rise and corporate office properties', 'ACTIVE'),
('RETAIL_PLAZA', 'Retail Plaza & Shopping Center', 'Open-air strip centers, grocery-anchored plazas, and regional retail', 'ACTIVE'),
('INDUSTRIAL_PARK', 'Industrial Logistics Hub', 'Distribution warehouses, flex facilities, and manufacturing parks', 'ACTIVE'),
('MEDICAL_CENTER', 'Medical Center Pavilion', 'Healthcare clinics, surgical centers, and outpatient medical buildings', 'ACTIVE');

-- 3. Seed Vendor Categories
INSERT INTO vendor_categories (category_code, name, description, status) VALUES
('UTILITIES_ENERGY', 'Utilities & Energy Management', 'Electric, water, gas, solar, and utility monitoring', 'ACTIVE'),
('HVAC_MECHANICAL', 'HVAC & Mechanical Systems', 'Heating, cooling, boilers, chillers, and preventative HVAC maintenance', 'ACTIVE'),
('JANITORIAL_CLEANING', 'Janitorial & Cleaning Services', 'Commercial daily office cleaning, trash removal, and sanitization', 'ACTIVE'),
('FIRE_LIFE_SAFETY', 'Fire & Life Safety Systems', 'Fire alarms, sprinkler inspections, extinguishers, and emergency lighting', 'ACTIVE'),
('SECURITY_ACCESS', 'Security & Access Control', 'Physical security, keycard access controls, and video surveillance', 'ACTIVE'),
('ELEVATOR_VERTICAL', 'Elevator & Vertical Transport', 'Elevator inspections, maintenance contracts, and cab servicing', 'ACTIVE'),
('LANDSCAPING_GROUNDS', 'Landscaping & Grounds Care', 'Groundskeeping, irrigation, snow removal, and exterior maintenance', 'ACTIVE'),
('GENERAL_MAINTENANCE', 'General Facility Maintenance', 'Handyman, lock repair, painting, drywall, and structural maintenance', 'ACTIVE');

-- 4. Seed Payment Methods
INSERT INTO payment_methods (method_code, name, description, status) VALUES
('ACH', 'ACH Direct Debit', 'Automated Clearing House electronic bank transfer', 'ACTIVE'),
('CHECK', 'Paper Check', 'Accounts Payable physical commercial bank check', 'ACTIVE'),
('CREDIT_CARD', 'Commercial Credit Card', 'Corporate purchasing card disbursement', 'ACTIVE');

-- 5. Seed Meaningful Properties (PostgreSQL generates property_uuid)
INSERT INTO properties (name, category, owner_entity, sqft, address, status) VALUES
(
    'Grandview Office Tower',
    'COMMERCIAL_OFFICE',
    'Apex Holdings LLC',
    720000,
    '{"streetAddress": "450 North Michigan Ave", "city": "Chicago", "state": "IL", "zipCode": "60611"}'::jsonb,
    'ACTIVE'
),
(
    'Harborfront Retail Plaza',
    'RETAIL_PLAZA',
    'Metropolitan Retail Trust',
    185000,
    '{"streetAddress": "1200 Pacific Coast Hwy", "city": "Long Beach", "state": "CA", "zipCode": "90802"}'::jsonb,
    'ACTIVE'
),
(
    'Apex Commerce Hub',
    'INDUSTRIAL_PARK',
    'Apex Holdings LLC',
    550000,
    '{"streetAddress": "8800 Interstate Parkway", "city": "Dallas", "state": "TX", "zipCode": "75241"}'::jsonb,
    'ACTIVE'
),
(
    'Metro Medical Pavilion',
    'MEDICAL_CENTER',
    'Healthcare Realty Partners',
    120000,
    '{"streetAddress": "7400 Fannin St", "city": "Houston", "state": "TX", "zipCode": "77054"}'::jsonb,
    'ACTIVE'
);

-- 5.1 Seed Property GL Accounts (Chart of Accounts Scoped to Building)
INSERT INTO property_gl_accounts (gl_code, property_uuid, gl_account_name, description, status)
SELECT '5100', p.property_uuid, 'Janitorial & Cleaning', 'Commercial daily cleaning and trash removal', 'ACTIVE'
FROM properties p WHERE p.name = 'Grandview Office Tower'
UNION ALL
SELECT '5200', p.property_uuid, 'HVAC Maintenance', 'Quarterly chiller, boiler, and filter maintenance', 'ACTIVE'
FROM properties p WHERE p.name = 'Grandview Office Tower'
UNION ALL
SELECT '5300', p.property_uuid, 'Utilities & Electric', 'Grid power and common area electricity', 'ACTIVE'
FROM properties p WHERE p.name = 'Grandview Office Tower'
UNION ALL
SELECT '5400', p.property_uuid, 'Security & Access Control', 'Badge systems and physical guard patrols', 'ACTIVE'
FROM properties p WHERE p.name = 'Grandview Office Tower'
UNION ALL
SELECT '5100', p.property_uuid, 'Janitorial Services', 'Plaza common area pressure washing and cleaning', 'ACTIVE'
FROM properties p WHERE p.name = 'Harborfront Retail Plaza'
UNION ALL
SELECT '5250', p.property_uuid, 'Plumbing & Sanitation', 'Sewer lines, grease traps, and water mains', 'ACTIVE'
FROM properties p WHERE p.name = 'Harborfront Retail Plaza'
UNION ALL
SELECT '5300', p.property_uuid, 'Utilities & Gas', 'Gas, water, and exterior floodlighting', 'ACTIVE'
FROM properties p WHERE p.name = 'Harborfront Retail Plaza'
UNION ALL
SELECT '5500', p.property_uuid, 'Landscaping & Grounds', 'Parking lot landscaping, trees, and snow removal', 'ACTIVE'
FROM properties p WHERE p.name = 'Harborfront Retail Plaza';

-- 6. Seed Meaningful Vendors (PostgreSQL generates vendor_uuid)
INSERT INTO vendors (vendor_name, category, tax_id, billing_phone_number, payment_method, status) VALUES
('Apex Utilities & HVAC', 'UTILITIES_ENERGY', '12-3456789', '555-0192', 'ACH', 'ACTIVE'),
('Beacon Fire & Life Safety', 'FIRE_LIFE_SAFETY', '98-7654321', '555-0144', 'CHECK', 'ACTIVE'),
('Cornerstone Commercial Janitorial', 'JANITORIAL_CLEANING', '45-6789012', '555-0188', 'CREDIT_CARD', 'ACTIVE');

-- 7. Map Vendor to Property dynamically with Cost Type & Default GL Code
INSERT INTO property_vendor_mapping (
    vendor_uuid,
    property_uuid,
    vendor_account_number,
    cost_type,
    default_gl_code,
    status,
    auto_approval_enabled
)
SELECT 
    v.vendor_uuid,
    p.property_uuid,
    'ACT-9483920',
    'FIXED_MONTHLY',
    '5200',
    'ACTIVE',
    TRUE
FROM vendors v, properties p
WHERE v.vendor_name = 'Apex Utilities & HVAC'
  AND p.name = 'Grandview Office Tower'
UNION ALL
SELECT 
    v.vendor_uuid,
    p.property_uuid,
    'ACT-1827401',
    'FIXED_MONTHLY',
    '5100',
    'ACTIVE',
    TRUE
FROM vendors v, properties p
WHERE v.vendor_name = 'Cornerstone Commercial Janitorial'
  AND p.name = 'Grandview Office Tower'
UNION ALL
SELECT 
    v.vendor_uuid,
    p.property_uuid,
    'ACT-5592811',
    'VARIABLE',
    '5400',
    'ACTIVE',
    FALSE
FROM vendors v, properties p
WHERE v.vendor_name = 'Beacon Fire & Life Safety'
  AND p.name = 'Grandview Office Tower';

-- 8. Seed Initial Test Invoice dynamically (PostgreSQL generates invoice_uuid)
INSERT INTO invoices (mapping_uuid, vendor_supplied_invoice_id, amount, invoice_status)
SELECT 
    m.mapping_uuid,
    'INV-2026-001',
    4500.00,
    'INGESTED'
FROM property_vendor_mapping m
WHERE m.vendor_account_number = 'ACT-9483920';

-- 9. Seed Corporate Roles & Standard Policy Tiers
INSERT INTO roles (role_slug, display_name, description) VALUES
('ADMIN',                   'System Administrator',         'Global system controller.'),
('ACCOUNTANT',              'Property Accountant',          'Manages books and general ledgers. No approval rights.'),
('PROPERTY_MANAGER',        'Property Manager (PM)',        'Handles baseline routine operations.'),
('SENIOR_PROPERTY_MANAGER', 'Senior Property Manager (SPM)','Manages flagship assets or regional complexes.'),
('REGIONAL_DIRECTOR',       'Regional Operations Director', 'Portfolio supervisor handling escalation limits.'),
('VICE_PRESIDENT',          'Vice President of Operations', 'Executive officer with portfolio-wide allocation power.')
ON CONFLICT (role_slug) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description;

INSERT INTO corporate_policy_tiers (tier_slug, display_name, allowed_role, variable_max, fixed_auto_max) VALUES
('TIER_NONE_ACCT',        'Accountant Processing Only',   'ACCOUNTANT',              0.00,        0.00),
('TIER_1_LOW_PM',         'Standard PM Operations Limit', 'PROPERTY_MANAGER',        1000.00,     2500.00),
('TIER_2_MID_SPM',        'Senior PM Operational Tier',   'SENIOR_PROPERTY_MANAGER', 5000.00,     10000.00),
('TIER_3_HIGH_RD',        'Regional Director Escalation', 'REGIONAL_DIRECTOR',       25000.00,    50000.00),
('TIER_4_UNLIMITED_VP',   'Executive VP Clearance Tier',  'VICE_PRESIDENT',          99999999.99, 99999999.99)
ON CONFLICT (tier_slug) DO UPDATE SET display_name = EXCLUDED.display_name, variable_max = EXCLUDED.variable_max, fixed_auto_max = EXCLUDED.fixed_auto_max;

-- 10. Seed CRE Users
INSERT INTO users (user_name, email, global_role, status) VALUES
('Sarah Jenkins', 's.jenkins@pmfirm.com', 'SENIOR_PROPERTY_MANAGER', 'ACTIVE'),
('Marcus Vance', 'm.vance@pmfirm.com', 'PROPERTY_MANAGER', 'ACTIVE'),
('Elena Rostova', 'e.rostova@pmfirm.com', 'ACCOUNTANT', 'ACTIVE'),
('David Sterling', 'd.sterling@pmfirm.com', 'REGIONAL_DIRECTOR', 'ACTIVE'),
('Victoria Chen', 'v.chen@pmfirm.com', 'VICE_PRESIDENT', 'ACTIVE')
ON CONFLICT (email) DO UPDATE SET user_name = EXCLUDED.user_name, global_role = EXCLUDED.global_role;

-- 11. Seed Property User Policy Clearances (Grandview Office Tower)
INSERT INTO property_user_policies (property_uuid, user_uuid, user_role, tier_slug, status)
SELECT p.property_uuid, u.user_uuid, u.global_role, 'TIER_2_MID_SPM', 'ACTIVE'
FROM properties p, users u
WHERE p.name = 'Grandview Office Tower' AND u.email = 's.jenkins@pmfirm.com'
UNION ALL
SELECT p.property_uuid, u.user_uuid, u.global_role, 'TIER_1_LOW_PM', 'ACTIVE'
FROM properties p, users u
WHERE p.name = 'Grandview Office Tower' AND u.email = 'm.vance@pmfirm.com'
UNION ALL
SELECT p.property_uuid, u.user_uuid, u.global_role, 'TIER_3_HIGH_RD', 'ACTIVE'
FROM properties p, users u
WHERE p.name = 'Grandview Office Tower' AND u.email = 'd.sterling@pmfirm.com'
ON CONFLICT (property_uuid, user_uuid) DO UPDATE SET tier_slug = EXCLUDED.tier_slug;

