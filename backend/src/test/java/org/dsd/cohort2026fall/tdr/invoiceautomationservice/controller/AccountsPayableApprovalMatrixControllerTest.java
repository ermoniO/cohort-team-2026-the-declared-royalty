package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.BadRequestException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.GlobalExceptionHandler;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.AccountsPayableApprovalMatrixService;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.PropertyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {AccountsPayableMetadataController.class, PropertyController.class})
@Import(GlobalExceptionHandler.class)
class AccountsPayableApprovalMatrixControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AccountsPayableApprovalMatrixService matrixService;

    @MockitoBean
    private PropertyService propertyService;

    @Test
    void getCorporateDesignations_returns200() throws Exception {
        CorporateDesignationResponse des = new CorporateDesignationResponse();
        des.setDesignationSlug("PROPERTY_MANAGER");
        des.setDisplayName("Property Manager");
        des.setStatus("ACTIVE");

        when(matrixService.getAllDesignations()).thenReturn(List.of(des));

        mockMvc.perform(get("/api/v1/corporate-designations").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].designationSlug").value("PROPERTY_MANAGER"))
                .andExpect(jsonPath("$[0].displayName").value("Property Manager"));

        verify(matrixService).getAllDesignations();
    }

    @Test
    void getAccountsPayableSeats_returns200() throws Exception {
        AccountsPayableSeatResponse seat = new AccountsPayableSeatResponse();
        seat.setAccountsPayableSeatSlug("PM_SEAT_FRISCO_OFFICE");
        seat.setDisplayName("Frisco Commercial Complex PM Seat");
        seat.setStatus("ACTIVE");

        when(matrixService.getAllSeats()).thenReturn(List.of(seat));

        mockMvc.perform(get("/api/v1/accounts-payable-seats").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].accountsPayableSeatSlug").value("PM_SEAT_FRISCO_OFFICE"));

        verify(matrixService).getAllSeats();
    }

    @Test
    void assignSeatOccupant_returns200() throws Exception {
        SeatAssignmentResponse resp = new SeatAssignmentResponse();
        resp.setAssignmentUuid(UUID.randomUUID());
        resp.setAccountsPayableSeatSlug("PM_SEAT_FRISCO_OFFICE");
        resp.setUserUuid(UUID.randomUUID());
        resp.setUserName("Marcus Vance");
        resp.setStatus("ACTIVE");

        when(matrixService.assignSeatOccupant(eq("PM_SEAT_FRISCO_OFFICE"), any(SeatAssignmentRequest.class)))
                .thenReturn(resp);

        String json = """
            {
                "userUuid": "%s"
            }
        """.formatted(resp.getUserUuid());

        mockMvc.perform(put("/api/v1/accounts-payable-seats/PM_SEAT_FRISCO_OFFICE/assignment")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountsPayableSeatSlug").value("PM_SEAT_FRISCO_OFFICE"))
                .andExpect(jsonPath("$.userName").value("Marcus Vance"));

        verify(matrixService).assignSeatOccupant(eq("PM_SEAT_FRISCO_OFFICE"), any(SeatAssignmentRequest.class));
    }

    @Test
    void getPropertyApprovalMatrix_returns200() throws Exception {
        UUID propertyId = UUID.randomUUID();
        AccountsPayableApprovalMatrixResponse step = new AccountsPayableApprovalMatrixResponse();
        step.setMatrixUuid(UUID.randomUUID());
        step.setPropertyUuid(propertyId);
        step.setAccountsPayableApprovalSequence(1);
        step.setAccountsPayableSeatSlug("PM_SEAT_FRISCO_OFFICE");
        step.setSeatDisplayName("Frisco PM Seat");
        step.setAccountsPayableThresholdSlug("LIMIT_LOW");
        step.setVariableMax(1000.0);
        step.setFixedAutoMax(2500.0);
        step.setStatus("ACTIVE");

        when(matrixService.getPropertyApprovalMatrix(propertyId)).thenReturn(List.of(step));

        mockMvc.perform(get("/api/v1/properties/{propertyId}/approval-matrix", propertyId)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].accountsPayableApprovalSequence").value(1))
                .andExpect(jsonPath("$[0].accountsPayableSeatSlug").value("PM_SEAT_FRISCO_OFFICE"));

        verify(matrixService).getPropertyApprovalMatrix(propertyId);
    }

    @Test
    void calculateInvoiceApprovalQueue_returns200() throws Exception {
        UUID propertyId = UUID.randomUUID();
        ApprovalQueueResponse queue = new ApprovalQueueResponse();
        queue.setPropertyUuid(propertyId);
        queue.setGrossAmount(5000.0);
        queue.setCostType("VARIABLE");
        queue.setHasVacantStep(false);

        ApprovalQueueStepResponse s1 = new ApprovalQueueStepResponse();
        s1.setSequence(1);
        s1.setSeatSlug("PM_SEAT_FRISCO_OFFICE");
        s1.setSeatDisplayName("Frisco PM Seat");
        s1.setIsVacant(false);
        s1.setIsProxy(false);
        s1.setThresholdSlug("LIMIT_MID");
        s1.setVariableMax(5000.0);
        s1.setFixedAutoMax(10000.0);

        queue.setSteps(List.of(s1));

        when(matrixService.calculateInvoiceRoutingQueue(eq(propertyId), eq(5000.0), anyString()))
                .thenReturn(queue);

        mockMvc.perform(get("/api/v1/properties/{propertyId}/approval-queue", propertyId)
                        .param("grossAmount", "5000.0")
                        .param("costType", "VARIABLE")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.grossAmount").value(5000.0))
                .andExpect(jsonPath("$.steps", hasSize(1)))
                .andExpect(jsonPath("$.steps[0].sequence").value(1));

        verify(matrixService).calculateInvoiceRoutingQueue(eq(propertyId), eq(5000.0), anyString());
    }

    @Test
    void deletePropertyApprovalMatrixStep_step5_returns400() throws Exception {
        UUID propertyId = UUID.randomUUID();
        doThrow(new BadRequestException("Sequence step 5 is the permanent fiduciary safety net and cannot be deleted"))
                .when(matrixService).deleteMatrixStep(propertyId, 5);

        mockMvc.perform(delete("/api/v1/properties/{propertyId}/approval-matrix/5", propertyId))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Sequence step 5 is the permanent fiduciary safety net and cannot be deleted"));

        verify(matrixService).deleteMatrixStep(propertyId, 5);
    }
}

