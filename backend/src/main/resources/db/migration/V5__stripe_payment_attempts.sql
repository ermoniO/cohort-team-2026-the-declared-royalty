CREATE TABLE payment_attempts
(
    payment_attempt_uuid    UUID PRIMARY KEY,
    invoice_uuid            UUID                     NOT NULL REFERENCES invoices (invoice_uuid) ON DELETE RESTRICT,
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    idempotency_key         VARCHAR(255)             NOT NULL UNIQUE,
    amount                  DECIMAL(10, 2)           NOT NULL,
    currency                VARCHAR(3)               NOT NULL,
    status                  VARCHAR(50)              NOT NULL,
    failure_reason          VARCHAR(2000),
    human_approved          BOOLEAN                  NOT NULL,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_attempts_invoice_uuid ON payment_attempts (invoice_uuid);
CREATE INDEX idx_payment_attempts_status ON payment_attempts (status);

CREATE TABLE stripe_webhook_events
(
    event_id    VARCHAR(255) PRIMARY KEY,
    event_type  VARCHAR(255)             NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
