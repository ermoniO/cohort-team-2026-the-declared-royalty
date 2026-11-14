package org.dsd.cohort2026fall.tdr.invoiceautomationservice.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

import java.net.URI;

@Configuration
@EnableConfigurationProperties(BlobStorageProperties.class)
public class BlobStorageConfig {

    // Building the client does not connect to blob storage,
    // so the app still starts if blob storage isn't running.
    @Bean
    public S3Client s3Client(BlobStorageProperties props) {

        return S3Client.builder()
                .endpointOverride(URI.create(props.endpoint()))
                .region(Region.of(props.region()))
                .credentialsProvider(
                        StaticCredentialsProvider.create(
                                AwsBasicCredentials.create(
                                        props.accessKey(),
                                        props.secretKey()
                                )
                        )
                )
                .forcePathStyle(true)
                .build();
    }
}
