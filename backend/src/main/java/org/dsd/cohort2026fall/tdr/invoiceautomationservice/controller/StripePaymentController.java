package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.api.StripePaymentsApi;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.StripePaymentRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.StripePaymentResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.StripePaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class StripePaymentController implements StripePaymentsApi {

    private final StripePaymentService stripePaymentService;

    public StripePaymentController(StripePaymentService stripePaymentService) {
        this.stripePaymentService = stripePaymentService;
    }

    @Override
    public ResponseEntity<StripePaymentResponse> createStripePayment(
            UUID invoiceUuid,
            StripePaymentRequest request) {
        return ResponseEntity.ok(stripePaymentService.createPayment(invoiceUuid, request));
    }

    @Override
    public ResponseEntity<Void> receiveStripeWebhook(String signature, String payload) {
        stripePaymentService.processWebhook(payload, signature);
        return ResponseEntity.ok().build();
    }
}
