ALTER TABLE payment_attempts
    ADD COLUMN exception_resolution_status VARCHAR(30),
    ADD COLUMN resolution_note VARCHAR(3000),
    ADD COLUMN resolved_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN resolved_by_user_uuid UUID REFERENCES users (user_uuid) ON DELETE RESTRICT;

ALTER TABLE payment_attempts
    ADD CONSTRAINT check_exception_resolution_status
        CHECK (exception_resolution_status IS NULL OR exception_resolution_status IN ('RETRY', 'VOID'));

ALTER TABLE invoices
    ADD COLUMN exception_resolution_status VARCHAR(30),
    ADD COLUMN exception_resolution_note VARCHAR(3000),
    ADD COLUMN exception_resolved_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN exception_resolved_by_user_uuid UUID REFERENCES users (user_uuid) ON DELETE RESTRICT;

ALTER TABLE invoices
    ADD CONSTRAINT check_invoice_exception_resolution_status
        CHECK (exception_resolution_status IS NULL OR exception_resolution_status IN ('RETRY', 'VOID'));
