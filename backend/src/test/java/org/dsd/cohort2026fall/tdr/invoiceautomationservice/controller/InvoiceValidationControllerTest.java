package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.GlobalExceptionHandler;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceValidationCheck;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceValidationCheck.IdEnum;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceValidationCheck.StatusEnum;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceValidationResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.InvoiceValidationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(InvoiceValidationController.class)
@Import(GlobalExceptionHandler.class)
class InvoiceValidationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private InvoiceValidationService validationService;

    @Test
    void returnsTheChecks() throws Exception {
        UUID invoiceUuid = UUID.randomUUID();
        InvoiceValidationCheck failed = new InvoiceValidationCheck(IdEnum.PROPERTY, "active property", StatusEnum.FAILED);
        failed.setDetail("Oak Street Lofts is inactive.");
        InvoiceValidationCheck passed = new InvoiceValidationCheck(IdEnum.AMOUNT, "amount and due date set", StatusEnum.PASSED);
        when(validationService.validate(invoiceUuid))
                .thenReturn(new InvoiceValidationResponse(invoiceUuid, false, 1, 2, List.of(failed, passed)));

        mockMvc.perform(get("/api/v1/invoices/{id}/validation", invoiceUuid))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passed").value(false))
                .andExpect(jsonPath("$.passedCount").value(1))
                .andExpect(jsonPath("$.checks[0].id").value("PROPERTY"))
                .andExpect(jsonPath("$.checks[0].status").value("FAILED"))
                .andExpect(jsonPath("$.checks[0].detail").value("Oak Street Lofts is inactive."))
                .andExpect(jsonPath("$.checks[1].status").value("PASSED"));
    }

    @Test
    void batch_returnsOneResultPerInvoice() throws Exception {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        InvoiceValidationCheck passed = new InvoiceValidationCheck(IdEnum.AMOUNT, "amount and due date set", StatusEnum.PASSED);
        when(validationService.validateAll(List.of(first, second))).thenReturn(List.of(
                new InvoiceValidationResponse(first, true, 1, 1, List.of(passed)),
                new InvoiceValidationResponse(second, true, 1, 1, List.of(passed))));

        mockMvc.perform(post("/api/v1/invoices/validation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"invoiceUuids\":[\"" + first + "\",\"" + second + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[1].invoiceUuid").value(second.toString()));
    }

    @Test
    void batch_withoutIds_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/invoices/validation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"invoiceUuids\":[]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unknownInvoice_returns404() throws Exception {
        UUID invoiceUuid = UUID.randomUUID();
        when(validationService.validate(invoiceUuid)).thenThrow(new ResourceNotFoundException("Invoice not found: " + invoiceUuid));

        mockMvc.perform(get("/api/v1/invoices/{id}/validation", invoiceUuid))
                .andExpect(status().isNotFound());
    }
}
