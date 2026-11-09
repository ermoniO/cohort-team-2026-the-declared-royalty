-- ============================================================================
-- 1. REFERENCE TABLES (Properties, Vendors Categories & Payment Methods)
-- ============================================================================
CREATE TABLE property_categories
(
    category_code VARCHAR(100) PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    description   VARCHAR(500),
    status        VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_property_category_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE vendor_categories
(
    category_code VARCHAR(100) PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    description   VARCHAR(500),
    status        VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_vendor_category_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE payment_methods
(
    method_code   VARCHAR(50) PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    description   VARCHAR(255),
    status        VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_payment_method_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

-- ============================================================================
-- 2. PROPERTIES (Physical Managed Real Estate Assets)
-- ============================================================================
CREATE TABLE properties
(
    property_uuid    UUID PRIMARY KEY         DEFAULT gen_random_uuid(),
    name             VARCHAR(255)                                       NOT NULL,
    category         VARCHAR(100)             NOT NULL REFERENCES property_categories (category_code) ON DELETE RESTRICT,
    owner_entity     VARCHAR(255),
    sqft             INTEGER,
    address          JSONB                                              NOT NULL,
    status           VARCHAR(50)              NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_property_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX idx_properties_address_zip ON properties ((address->>'zipCode'));

-- ============================================================================
-- 2.1 PROPERTY GL ACCOUNTS (Charts of Accounts Scoped to Specific Property)
-- ============================================================================
CREATE TABLE property_gl_accounts
(
    property_gl_account_uuid UUID                     NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    gl_code                  VARCHAR(50)              NOT NULL,
    property_uuid            UUID                     NOT NULL REFERENCES properties (property_uuid) ON DELETE CASCADE,
    gl_account_name          VARCHAR(100)             NOT NULL,
    description              VARCHAR(500),
    status                   VARCHAR(50)              NOT NULL DEFAULT 'ACTIVE',
    created_at               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (gl_code, property_uuid),
    CONSTRAINT check_property_gl_account_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

-- ============================================================================
-- 3. VENDORS (Suppliers & Service Providers)
-- ============================================================================
CREATE TABLE vendors
(
    vendor_uuid          UUID PRIMARY KEY         DEFAULT gen_random_uuid(), -- UUID Auto generates
    vendor_name          VARCHAR(255)             NOT NULL,
    category             VARCHAR(100)             REFERENCES vendor_categories (category_code) ON DELETE SET NULL,
    tax_id               VARCHAR(50),
    billing_phone_number VARCHAR(255),
    status               VARCHAR(50)              NOT NULL DEFAULT 'ACTIVE',
    payment_url          VARCHAR(225),
    payment_method       VARCHAR(50)              NOT NULL REFERENCES payment_methods (method_code) ON DELETE RESTRICT,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_vendor_status CHECK ( status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE property_vendor_mapping
(
    mapping_uuid          UUID PRIMARY KEY         DEFAULT gen_random_uuid(), -- Use this as key for mapping the front-end
    vendor_uuid           UUID                     NOT NULL REFERENCES vendors (vendor_uuid) ON DELETE RESTRICT,
    property_uuid         UUID                     NOT NULL REFERENCES properties (property_uuid) ON DELETE RESTRICT,
    vendor_account_number VARCHAR(100)             NOT NULL, -- vendor assigned account number
    cost_type             VARCHAR(20)              NOT NULL DEFAULT 'VARIABLE',
    default_gl_code       VARCHAR(50),
    status                VARCHAR(255)             NOT NULL DEFAULT 'ACTIVE',
    auto_approval_enabled BOOLEAN                  NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_mapping_status CHECK ( status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT check_cost_type CHECK (cost_type IN ('FIXED_MONTHLY', 'VARIABLE')),
    CONSTRAINT unique_key_property_vendor UNIQUE (vendor_uuid, property_uuid),
    CONSTRAINT fk_mapping_property_gl_account FOREIGN KEY (default_gl_code, property_uuid)
        REFERENCES property_gl_accounts (gl_code, property_uuid) ON DELETE CASCADE
);

CREATE TABLE invoices
(
    invoice_uuid               UUID PRIMARY KEY    DEFAULT gen_random_uuid(), -- property supplied invoice id
    vendor_supplied_invoice_id VARCHAR(100),       -- vendor supplied invoice id
    mapping_uuid               UUID                NOT NULL REFERENCES property_vendor_mapping (mapping_uuid) ON DELETE RESTRICT, -- FOREIGN KEY TO INVOICES TABLES
    billing_period_start       DATE,
    billing_period_end         DATE,
    invoice_creation_date      DATE,
    amount                     DECIMAL(10, 2),
    due_date                   DATE,
    invoice_status             VARCHAR(100)         NOT NULL DEFAULT 'INGESTED',
    failure_reason             VARCHAR(2000),
    blob_file_url              VARCHAR(1000),       -- Only for file upload (pdf, images, etc.)
    blob_file_sha256           VARCHAR(100),
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_invoice_status CHECK ( invoice_status IN
                                    ('INGESTED', 'PENDING_MAPPING', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'FAILED',
                                     'PROCESSING_PAYMENT', 'VOID'))
);

CREATE TABLE roles
(
    role_slug    VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    description  TEXT,
    status       VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE',
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_role_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT check_role_slug CHECK (role_slug IN ('ADMIN', 'ACCOUNTANT', 'PROPERTY_MANAGER', 'SENIOR_PROPERTY_MANAGER', 'REGIONAL_DIRECTOR', 'VICE_PRESIDENT'))
);

INSERT INTO roles (role_slug, display_name, description) VALUES
('ADMIN', 'System Administrator', 'Global system controller.'),
('ACCOUNTANT', 'Property Accountant', 'Manages books and general ledgers. No approval rights.'),
('PROPERTY_MANAGER', 'Property Manager (PM)', 'Handles baseline routine operations.'),
('SENIOR_PROPERTY_MANAGER', 'Senior Property Manager (SPM)', 'Manages flagship assets or regional complexes.'),
('REGIONAL_DIRECTOR', 'Regional Operations Director', 'Portfolio supervisor handling escalation limits.'),
('VICE_PRESIDENT', 'Vice President of Operations', 'Executive officer with portfolio-wide allocation power.');

CREATE TABLE users
(
    user_uuid   UUID PRIMARY KEY         DEFAULT gen_random_uuid(),
    user_name   VARCHAR(255)             NOT NULL,
    email       VARCHAR(255)             NOT NULL UNIQUE,
    global_role VARCHAR(50)              NOT NULL REFERENCES roles (role_slug),
    status      VARCHAR(10)              NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_user_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT unique_user_role_bridge UNIQUE (user_uuid, global_role)
);

CREATE TABLE corporate_policy_tiers
(
    tier_slug      VARCHAR(50) PRIMARY KEY,
    display_name   VARCHAR(100)   NOT NULL,
    allowed_role   VARCHAR(50)    NOT NULL REFERENCES roles (role_slug),
    variable_max   NUMERIC(12, 2) NOT NULL,
    fixed_auto_max NUMERIC(12, 2) NOT NULL,
    status         VARCHAR(10)    NOT NULL DEFAULT 'ACTIVE',
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_policy_tier_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT check_policy_tier_slug CHECK (tier_slug IN ('TIER_NONE_ACCT', 'TIER_1_LOW_PM', 'TIER_2_MID_SPM', 'TIER_3_HIGH_RD', 'TIER_4_UNLIMITED_VP')),
    CONSTRAINT unique_tier_role_bridge UNIQUE (tier_slug, allowed_role)
);

INSERT INTO corporate_policy_tiers (tier_slug, display_name, allowed_role, variable_max, fixed_auto_max) VALUES
('TIER_NONE_ACCT', 'Accountant Processing Only', 'ACCOUNTANT', 0.00, 0.00),
('TIER_1_LOW_PM', 'Standard PM Operations Limit', 'PROPERTY_MANAGER', 1000.00, 2500.00),
('TIER_2_MID_SPM', 'Senior PM Operational Tier', 'SENIOR_PROPERTY_MANAGER', 5000.00, 10000.00),
('TIER_3_HIGH_RD', 'Regional Director Escalation', 'REGIONAL_DIRECTOR', 25000.00, 50000.00),
('TIER_4_UNLIMITED_VP', 'Executive VP Clearance Tier', 'VICE_PRESIDENT', 99999999.99, 99999999.99);

CREATE TABLE property_user_policies
(
    property_uuid UUID        NOT NULL REFERENCES properties (property_uuid) ON DELETE CASCADE,
    user_uuid     UUID        NOT NULL,
    user_role     VARCHAR(50) NOT NULL,
    tier_slug     VARCHAR(50) NOT NULL,
    status        VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (property_uuid, user_uuid),
    CONSTRAINT check_prop_user_policy_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT fk_enforce_user_identity_match
        FOREIGN KEY (user_uuid, user_role)
            REFERENCES users (user_uuid, global_role) ON DELETE CASCADE,
    CONSTRAINT fk_enforce_policy_role_legality
        FOREIGN KEY (tier_slug, user_role)
            REFERENCES corporate_policy_tiers (tier_slug, allowed_role) ON DELETE RESTRICT
);

CREATE TABLE audit_logs
(
    audit_uuid   UUID PRIMARY KEY         DEFAULT gen_random_uuid(),
    invoice_uuid UUID                     NOT NULL NOT NULL REFERENCES invoices (invoice_uuid) ON DELETE RESTRICT,
    user_uuid    UUID                     NOT NULL REFERENCES users (user_uuid) ON DELETE RESTRICT,
    action_type  VARCHAR(255),
    action_taken VARCHAR(225),
    from_state   VARCHAR(255),
    to_state     VARCHAR(255),
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
