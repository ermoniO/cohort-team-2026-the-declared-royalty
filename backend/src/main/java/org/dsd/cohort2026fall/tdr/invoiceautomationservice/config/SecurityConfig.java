package org.dsd.cohort2026fall.tdr.invoiceautomationservice.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

@Configuration
@EnableConfigurationProperties(OauthProperties.class)
public class SecurityConfig {

    @Value("${frontend.url}")
    private String frontendUrl;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(frontendUrl));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public JwtDecoder jwtDecoder(OauthProperties props) {
        if (props.issuerUri() == null || props.issuerUri().isBlank()) {
            throw new IllegalStateException("oauth.issuer-uri must be configured.");
        }

        if (props.jwkSetUri() != null && !props.jwkSetUri().isBlank()) {
            NimbusJwtDecoder decoder = NimbusJwtDecoder
                    .withJwkSetUri(props.jwkSetUri())
                    .build();
            decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(props.issuerUri()));
            return decoder;
        }

        if (props.secretKey() != null && !props.secretKey().isBlank()) {
            SecretKeySpec secretKeySpec = new SecretKeySpec(props.secretKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            NimbusJwtDecoder decoder = NimbusJwtDecoder
                    .withSecretKey(secretKeySpec)
                    .macAlgorithm(MacAlgorithm.HS256)
                    .build();
            decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(props.issuerUri()));
            return decoder;
        }

        throw new IllegalStateException(
                "Configure oauth.jwk-set-uri or oauth.secret-key to verify JWT signatures."
        );
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
         return http
                 .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                 .csrf(AbstractHttpConfigurer::disable)
                 .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
                 .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
                 .build();
    }
}
