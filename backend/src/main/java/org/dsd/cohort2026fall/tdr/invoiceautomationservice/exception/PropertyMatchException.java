package org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception;

/** An address couldn't be matched to exactly one property-vendor mapping, so nothing was changed. */
public class PropertyMatchException extends RuntimeException {
    public PropertyMatchException(String message) {
        super(message);
    }
}
