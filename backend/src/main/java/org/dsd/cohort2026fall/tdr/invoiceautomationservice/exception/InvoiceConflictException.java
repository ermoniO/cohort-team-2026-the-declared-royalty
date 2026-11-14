package org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception;

// The request conflicts with the invoice's current state (e.g. already past review). Maps to 409.
public class InvoiceConflictException extends RuntimeException {
    public InvoiceConflictException(String message) {
        super(message);
    }
}
