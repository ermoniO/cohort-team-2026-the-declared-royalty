package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.api.CorporatePoliciesApi;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.api.RolesApi;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.CorporatePolicyTierResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.RoleResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.PropertyPolicyService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class CorporatePolicyController implements RolesApi, CorporatePoliciesApi {

    private final PropertyPolicyService propertyPolicyService;

    public CorporatePolicyController(PropertyPolicyService propertyPolicyService) {
        this.propertyPolicyService = propertyPolicyService;
    }

    @Override
    public ResponseEntity<List<RoleResponse>> getRoles() {
        return ResponseEntity.ok(propertyPolicyService.getAllRoles());
    }

    @Override
    public ResponseEntity<List<CorporatePolicyTierResponse>> getCorporatePolicyTiers() {
        return ResponseEntity.ok(propertyPolicyService.getAllPolicyTiers());
    }
}

