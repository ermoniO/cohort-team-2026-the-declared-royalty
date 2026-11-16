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

CREATE TABLE corporate_designations
(
    designation_slug VARCHAR(50) PRIMARY KEY,
    display_name     VARCHAR(100) NOT NULL,
    status           VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_designation_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE accounts_payable_seats
(
    accounts_payable_seat_slug VARCHAR(50) PRIMARY KEY,
    display_name               VARCHAR(100) NOT NULL,
    status                     VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE',
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_ap_seat_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE accounts_payable_threshold_presets
(
    accounts_payable_threshold_slug VARCHAR(50) PRIMARY KEY,
    variable_max                    NUMERIC(12, 2) NOT NULL CHECK (variable_max >= 0.00),
    fixed_auto_max                  NUMERIC(12, 2) NOT NULL CHECK (fixed_auto_max >= 0.00),
    status                          VARCHAR(10)    NOT NULL DEFAULT 'ACTIVE',
    created_at                      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at                      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_ap_preset_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE users
(
    user_uuid           UUID PRIMARY KEY         DEFAULT gen_random_uuid(),
    user_name           VARCHAR(255)             NOT NULL,
    email               VARCHAR(255)             NOT NULL UNIQUE,
    delegate_user_uuid  UUID                     REFERENCES users (user_uuid) ON DELETE SET NULL,
    delegate_expires_at TIMESTAMP WITH TIME ZONE,
    status              VARCHAR(10)              NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_user_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT check_no_self_delegation CHECK (delegate_user_uuid != user_uuid)
);

CREATE TABLE accounts_payable_seat_assignment
(
    assignment_uuid            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    accounts_payable_seat_slug VARCHAR(50) NOT NULL REFERENCES accounts_payable_seats (accounts_payable_seat_slug) ON DELETE CASCADE,
    user_uuid                  UUID        NOT NULL REFERENCES users (user_uuid) ON DELETE CASCADE,
    status                     VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_seat_assign_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT unique_user_seat_pairing UNIQUE (accounts_payable_seat_slug, user_uuid)
);

CREATE UNIQUE INDEX unique_active_seat_occupant
ON accounts_payable_seat_assignment (accounts_payable_seat_slug)
WHERE (status = 'ACTIVE');

CREATE TABLE accounts_payable_approval_matrix
(
    matrix_uuid                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_uuid                      UUID        NOT NULL REFERENCES properties (property_uuid) ON DELETE CASCADE,
    accounts_payable_seat_slug         VARCHAR(50) NOT NULL REFERENCES accounts_payable_seats (accounts_payable_seat_slug),
    accounts_payable_threshold_slug    VARCHAR(50) NOT NULL REFERENCES accounts_payable_threshold_presets (accounts_payable_threshold_slug),
    accounts_payable_approval_sequence INT         NOT NULL CHECK (accounts_payable_approval_sequence BETWEEN 0 AND 5),
    status                             VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    created_at                         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at                         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_matrix_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE UNIQUE INDEX unique_active_property_seat_step
ON accounts_payable_approval_matrix (property_uuid, accounts_payable_seat_slug)
WHERE (status = 'ACTIVE');

CREATE UNIQUE INDEX unique_active_property_sequence_step
ON accounts_payable_approval_matrix (property_uuid, accounts_payable_approval_sequence)
WHERE (status = 'ACTIVE');

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
