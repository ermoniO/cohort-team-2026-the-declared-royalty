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
    address          JSONB                                              NOT NULL,
    status           VARCHAR(50)              NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_property_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX idx_properties_address_zip ON properties ((address->>'zipCode'));

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
    status                VARCHAR(255)             NOT NULL DEFAULT 'ACTIVE',
    auto_approval_enabled BOOLEAN                  NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_mapping_status CHECK ( status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT unique_key_property_vendor UNIQUE (vendor_uuid, property_uuid)
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

CREATE TABLE users
(
    user_uuid  UUID PRIMARY KEY         DEFAULT gen_random_uuid(),
    user_name  VARCHAR(255)             NOT NULL,
    email      VARCHAR(255)             NOT NULL,
    role       VARCHAR(255)             NOT NULL DEFAULT 'ADMIN',
    status     VARCHAR(255)             NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_role CHECK ( role IN ('AI', 'ADMIN', 'SUPER_ADMIN')),
    CONSTRAINT check_user_status CHECK ( status IN ('ACTIVE', 'INACTIVE'))
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
