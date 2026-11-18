-- Who uploaded the bill's file: the person a "Request information" goes back to.
-- Null for manually entered invoices.
ALTER TABLE invoices ADD COLUMN uploaded_by UUID REFERENCES users (user_uuid) ON DELETE RESTRICT;

-- Backfill earlier uploads from their upload audit entry, which recorded the acting user
-- (the System user, until uploads started passing a real one)
UPDATE invoices i
SET uploaded_by = a.user_uuid
FROM audit_logs a
WHERE a.invoice_uuid = i.invoice_uuid
  AND a.action_taken = 'File uploaded and stored'
  AND i.uploaded_by IS NULL;
