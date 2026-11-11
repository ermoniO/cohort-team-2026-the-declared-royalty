package org.dsd.cohort2026fall.tdr.invoiceautomationservice.config;

import com.stripe.StripeClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(StripeProperties.class)
public class StripeConfig {

    @Bean
    @ConditionalOnProperty(name = "stripe.enabled", havingValue = "true")
    StripeClient stripeClient(StripeProperties properties) {
        if (properties.secretKey() == null || properties.secretKey().isBlank()) {
            throw new IllegalStateException("STRIPE_SECRET_KEY is required when Stripe is enabled");
        }
        return StripeClient.builder()
                .setApiKey(properties.secretKey())
                .setMaxNetworkRetries(0)
                .build();
    }
}
