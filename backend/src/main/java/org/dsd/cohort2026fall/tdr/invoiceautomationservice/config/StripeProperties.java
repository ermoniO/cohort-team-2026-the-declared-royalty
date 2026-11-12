package org.dsd.cohort2026fall.tdr.invoiceautomationservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "stripe")
public record StripeProperties(
        boolean enabled,
        String secretKey,
        String webhookSecret,
        String currency) {
}
