package org.dsd.cohort2026fall.tdr.invoiceautomationservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "oauth")
public record OauthProperties(
        String jwkSetUri,
        String issuerUri,
        String secretKey
) {
}
