package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import lombok.RequiredArgsConstructor;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.api.InvoiceExtractionApi;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceExtractionResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceProgressRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceVerifyRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.InvoiceExtractionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class InvoiceExtractionController implements InvoiceExtractionApi {

    private final InvoiceExtractionService extractionService;

    @Override
    public ResponseEntity<InvoiceExtractionResponse> extractInvoice(UUID invoiceUuid) {
        return ResponseEntity.ok(extractionService.extract(invoiceUuid));
    }

    @Override
    public ResponseEntity<InvoiceResponse> verifyInvoice(UUID invoiceUuid, InvoiceVerifyRequest invoiceVerifyRequest) {
        return ResponseEntity.ok(extractionService.verify(invoiceUuid, invoiceVerifyRequest));
    }

    @Override
    public ResponseEntity<InvoiceResponse> saveInvoiceProgress(UUID invoiceUuid, InvoiceProgressRequest invoiceProgressRequest) {
        return ResponseEntity.ok(extractionService.saveProgress(invoiceUuid, invoiceProgressRequest));
     }

}