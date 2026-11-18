package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import lombok.RequiredArgsConstructor;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.api.InvoiceValidationApi;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceValidationBatchRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceValidationResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.InvoiceValidationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class InvoiceValidationController implements InvoiceValidationApi {

    private final InvoiceValidationService validationService;

    @Override
    public ResponseEntity<InvoiceValidationResponse> getInvoiceValidation(UUID invoiceUuid) {
        return ResponseEntity.ok(validationService.validate(invoiceUuid));
    }

    @Override
    public ResponseEntity<List<InvoiceValidationResponse>> getInvoiceValidations(InvoiceValidationBatchRequest request) {
        return ResponseEntity.ok(validationService.validateAll(request.getInvoiceUuids()));
    }
}
