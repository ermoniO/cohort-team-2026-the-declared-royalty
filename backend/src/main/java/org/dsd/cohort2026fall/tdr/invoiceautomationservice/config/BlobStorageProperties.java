package org.dsd.cohort2026fall.tdr.invoiceautomationservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "blob-storage")
public record BlobStorageProperties(
        String endpoint,
        String accessKey,
        String secretKey,
        String bucket,
        String region
) {}
