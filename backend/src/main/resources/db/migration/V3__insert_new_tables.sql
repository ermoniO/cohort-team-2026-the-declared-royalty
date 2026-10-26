CREATE TABLE vendors
(
    vendor_uuid          UUID PRIMARY KEY         DEFAULT gen_random_uuid(), -- UUID Auto generates
    vendor_name          VARCHAR(255)             NOT NULL,
    billing_phone_number VARCHAR(255),
    status               VARCHAR(255)             NOT NULL DEFAULT 'ACTIVE',
    payment_url          VARCHAR(225),
    payment_method       VARCHAR(255)             NOT NULL DEFAULT 'ACH',
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_payment_method CHECK ( payment_method IN ('CHECK', 'CREDIT_CARD', 'ACH')),
    CONSTRAINT check_status CHECK ( status IN ('ACTIVE', 'INACTIVE'))
);
-- CREATE INDEX idx_vendor_name ON vendors (vendor_name);
-- CREATE INDEX idx_property_name ON properties (name);

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
    CONSTRAINT check_status CHECK ( status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT unique_key_property_vendor UNIQUE (vendor_uuid, property_uuid)
);
-- CREATE INDEX idx_vendor_id ON vendors (vendor_id);
-- CREATE INDEX idx_property_id ON properties (property_id);
-- CREATE INDEX idx_pvm_vendor_account_number ON property_vendor_mapping (vendor_account_number);
-- CREATE INDEX idx_pvm_vendor_id ON property_vendor_mapping (vendor_id);
-- CREATE INDEX idx_pvm_property_id ON property_vendor_mapping (property_id);


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
    CONSTRAINT check_status CHECK ( invoice_status IN
                                    ('INGESTED', 'PENDING_MAPPING', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'FAILED',
                                     'PROCESSING_PAYMENT', 'VOID'))
);
-- Indexing for invoice_status, blob_file_url, blob_file_sha256, and mapping_uuid
-- CREATE INDEX idx_invoice_status ON invoices (invoice_status);
-- CREATE INDEX idx_blob_file_url ON invoices (blob_file_url);
-- CREATE INDEX idx_blob_file_sha256 ON invoices (blob_file_sha256);
-- CREATE INDEX idx_invoice_mapping_uuid ON invoices (mapping_uuid);

CREATE TABLE users
(
    user_uuid  UUID PRIMARY KEY         DEFAULT gen_random_uuid(),
    user_name  VARCHAR(255)             NOT NULL,
    email      VARCHAR(255)             NOT NULL,
    role       VARCHAR(255)             NOT NULL DEFAULT 'ADMIN',
    is_active  VARCHAR(255)             NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_role CHECK ( role IN ('AI', 'ADMIN', 'SUPER_ADMIN')),
    CONSTRAINT check_is_active CHECK ( is_active IN ('ACTIVE', 'INACTIVE'))
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
    notes        VARCHAR(3000),
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
-- Indexing audit_logs on invoice_uuid
-- CREATE INDEX idx_audit_logs ON audit_logs (audit_uuid);

ALTER TABLE properties
    RENAME property_id to property_uuid;

ALTER TABLE properties
    ADD CONSTRAINT pk_properties PRIMARY KEY (property_uuid);