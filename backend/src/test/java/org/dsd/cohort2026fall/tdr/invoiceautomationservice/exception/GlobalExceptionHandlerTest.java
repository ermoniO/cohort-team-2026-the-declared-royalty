package org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.ErrorResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceStatus;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void invalidTransition_returns409WithErrorResponse() {
        MockHttpServletRequest request = new MockHttpServletRequest("PATCH", "/api/v1/invoices/abc");
        request.setRequestURI("/api/v1/invoices/abc");

        ResponseEntity<ErrorResponse> response = handler.handleInvalidStatusTransition(
                new InvalidStatusTransitionException(InvoiceStatus.PAID, InvoiceStatus.PENDING_APPROVAL), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getStatus()).isEqualTo(409);
        assertThat(response.getBody().getMessage()).isEqualTo("Invoice cannot move from PAID to PENDING_APPROVAL");
        assertThat(response.getBody().getPath()).isEqualTo("/api/v1/invoices/abc");
    }
}

