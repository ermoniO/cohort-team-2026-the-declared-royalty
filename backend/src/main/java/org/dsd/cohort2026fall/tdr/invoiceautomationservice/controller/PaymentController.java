package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.api.PaymentsApi;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.PaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class PaymentController implements PaymentsApi {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @Override
    public ResponseEntity<PaymentPageResponse> getPayments(Integer page, Integer size, List<PaymentStatus> status, String q) {
        return ResponseEntity.ok(paymentService.getPayments(page, size, status, q));
    }

    @Override
    public ResponseEntity<PaymentSummaryResponse> getPaymentSummary() {
        return ResponseEntity.ok(paymentService.getSummary());
    }

    @Override
    public ResponseEntity<PaymentResponse> getPaymentById(UUID paymentId) {
        return ResponseEntity.ok(paymentService.getPayment(paymentId));
    }

    @Override
    public ResponseEntity<AutoPaySettingsResponse> getAutoPaySettings() {
        return ResponseEntity.ok(paymentService.getAutoPaySettings());
    }

    @Override
    public ResponseEntity<AutoPaySettingsResponse> updateAutoPaySettings(AutoPaySettingsRequest request) {
        return ResponseEntity.ok(paymentService.updateAutoPaySettings(request));
    }

    @Override
    public ResponseEntity<PaymentResponse> payNow(UUID paymentId, PayNowRequest payNowRequest) {
        return ResponseEntity.ok(paymentService.payNow(paymentId, payNowRequest));
    }

}
