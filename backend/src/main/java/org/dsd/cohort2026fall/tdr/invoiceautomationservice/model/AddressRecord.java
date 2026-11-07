package org.dsd.cohort2026fall.tdr.invoiceautomationservice.model;

import java.io.Serializable;

public record AddressRecord(
    String streetAddress,
    String city,
    String state,
    String zipCode
) implements Serializable {}
