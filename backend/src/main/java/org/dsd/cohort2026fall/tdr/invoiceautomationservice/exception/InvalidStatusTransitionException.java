package org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceStatus;

public class InvalidStatusTransitionException extends RuntimeException {

    public InvalidStatusTransitionException(InvoiceStatus from, InvoiceStatus to) {
        super("Invoice cannot move from " + from + " to " + to);
    }
}

