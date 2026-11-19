-- Who started each payment attempt: a person using Pay now (MANUAL) or the
-- auto-pay scheduler (AUTO_PAY). Null for attempts made before this column existed.
ALTER TABLE payment_attempts
    ADD COLUMN payment_source VARCHAR(20);

ALTER TABLE payment_attempts
    ADD CONSTRAINT check_payment_source
        CHECK (payment_source IS NULL OR payment_source IN ('MANUAL', 'AUTO_PAY'));