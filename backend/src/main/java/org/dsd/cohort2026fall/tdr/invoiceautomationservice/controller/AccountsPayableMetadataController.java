package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.api.AccountsPayableSeatsApi;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.api.AccountsPayableThresholdPresetsApi;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.api.CorporateDesignationsApi;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.AccountsPayableApprovalMatrixService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class AccountsPayableMetadataController implements CorporateDesignationsApi, AccountsPayableSeatsApi, AccountsPayableThresholdPresetsApi {

    private final AccountsPayableApprovalMatrixService matrixService;

    public AccountsPayableMetadataController(AccountsPayableApprovalMatrixService matrixService) {
        this.matrixService = matrixService;
    }

    @Override
    public ResponseEntity<List<CorporateDesignationResponse>> getCorporateDesignations() {
        return ResponseEntity.ok(matrixService.getAllDesignations());
    }

    @Override
    public ResponseEntity<List<AccountsPayableSeatResponse>> getAccountsPayableSeats() {
        return ResponseEntity.ok(matrixService.getAllSeats());
    }

    @Override
    public ResponseEntity<SeatAssignmentResponse> assignSeatOccupant(String seatSlug, SeatAssignmentRequest seatAssignmentRequest) {
        return ResponseEntity.ok(matrixService.assignSeatOccupant(seatSlug, seatAssignmentRequest));
    }

    @Override
    public ResponseEntity<Void> vacateSeat(String seatSlug) {
        matrixService.vacateSeat(seatSlug);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<List<AccountsPayableThresholdPresetResponse>> getAccountsPayableThresholdPresets() {
        return ResponseEntity.ok(matrixService.getAllPresets());
    }
}

