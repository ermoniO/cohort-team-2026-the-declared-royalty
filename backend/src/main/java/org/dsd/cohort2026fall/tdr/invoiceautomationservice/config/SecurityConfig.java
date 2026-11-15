package org.dsd.cohort2026fall.tdr.invoiceautomationservice.config;

import com.nimbusds.jwt.SignedJWT;
import org.springframework.beans.factory.annotation.Value;
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
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

@Configuration
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
        if (props.jwkSetUri() != null && !props.issuerUri().isBlank()) {
            return NimbusJwtDecoder.withJwkSetUri(props.jwkSetUri()).build();
        }
        if (props.issuerUri() != null && !props.issuerUri().isBlank()) {
            return JwtDecoders.fromIssuerLocation(props.issuerUri());
        }
        if (props.secretKey() != null && !props.secretKey().isBlank()) {
            SecretKeySpec secretKeySpec = new SecretKeySpec(props.secretKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            return NimbusJwtDecoder.withSecretKey(secretKeySpec).macAlgorithm(MacAlgorithm.HS256).build();
        }

//         Fallback decoder for dev/testing when no external issuer or secret is configured
        return token -> {
            try {
                SignedJWT signedJWT = SignedJWT.parse(token);
                var claimsSet = signedJWT.getJWTClaimsSet();
                Map<String, Object> headers = new HashMap<>(signedJWT.getHeader().toJSONObject());
                Map<String, Object> claims = new HashMap<>(claimsSet.getClaims());

                Instant issuedAt = claimsSet.getIssueTime() != null ? claimsSet.getIssueTime().toInstant() : Instant.now();
                Instant expiresAt = claimsSet.getExpirationTime() != null ? claimsSet.getExpirationTime().toInstant() : Instant.now().plusSeconds(3600);

                return new Jwt(token, issuedAt, expiresAt, headers, claims);
            } catch (Exception e) {
                throw new JwtException("Failed to decode token", e);
            }
        };
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
         return http
                 .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                 .csrf(AbstractHttpConfigurer::disable)
                 .authorizeHttpRequests(auth -> {
                     auth.requestMatchers(
                             "/swagger-ui/**",
                             "/swagger-ui.html",
                             "/v3/api-docs/**",
                             "/swagger-resources/**",
                             "/webjars/**"
                     ).permitAll();
                     auth.anyRequest().authenticated();
//                    auth.anyRequest().permitAll();
                 })
                 .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
                 .build();
    }
}
