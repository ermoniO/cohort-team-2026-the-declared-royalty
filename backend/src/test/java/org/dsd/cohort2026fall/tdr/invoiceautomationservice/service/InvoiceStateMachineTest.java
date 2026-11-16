package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.AuditLogCreateRequest.ActionTypeEnum;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceStatus.*;

class InvoiceStateMachineTest {

    private static final Map<InvoiceStatus, Set<InvoiceStatus>> TABLE = Map.of(
            INGESTED, EnumSet.of(PENDING_MAPPING, PENDING_APPROVAL, FAILED, VOID),
            PENDING_MAPPING, EnumSet.of(PENDING_APPROVAL, FAILED, VOID),
            PENDING_APPROVAL, EnumSet.of(APPROVED, PENDING_MAPPING, FAILED, VOID),
            APPROVED, EnumSet.of(PROCESSING_PAYMENT, PAID, FAILED, VOID),
            PROCESSING_PAYMENT, EnumSet.of(PAID, FAILED),
            FAILED, EnumSet.of(PENDING_MAPPING, PENDING_APPROVAL, VOID),
            PAID, EnumSet.noneOf(InvoiceStatus.class),
            VOID, EnumSet.noneOf(InvoiceStatus.class));

    @ParameterizedTest
    @EnumSource(InvoiceStatus.class)
    void allowedTransitions_matchTable(InvoiceStatus from) {
        for (InvoiceStatus to : InvoiceStatus.values()) {
            boolean expected = TABLE.get(from).contains(to);
            assertThat(InvoiceStateMachine.isAllowed(from, to))
                    .as("%s -> %s", from, to)
                    .isEqualTo(expected);
        }
        assertThat(InvoiceStateMachine.allowedFrom(from)).isEqualTo(TABLE.get(from));
    }

    @Test
    void sameState_isNeverAllowed() {
        for (InvoiceStatus status : InvoiceStatus.values()) {
            assertThat(InvoiceStateMachine.isAllowed(status, status)).isFalse();
        }
    }

    @Test
    void terminalStates_haveNoOutgoingTransitions() {
        assertThat(InvoiceStateMachine.allowedFrom(PAID)).isEmpty();
        assertThat(InvoiceStateMachine.allowedFrom(VOID)).isEmpty();
    }

    @Test
    void auditActionFor_mapsEachTargetState() {
        assertThat(InvoiceStateMachine.auditActionFor(PENDING_MAPPING, true)).isEqualTo(ActionTypeEnum.USER_IDENTIFIED);
        assertThat(InvoiceStateMachine.auditActionFor(PENDING_APPROVAL, false)).isEqualTo(ActionTypeEnum.SYSTEM_MATCHED);
        assertThat(InvoiceStateMachine.auditActionFor(APPROVED, true)).isEqualTo(ActionTypeEnum.USER_APPROVED);
        assertThat(InvoiceStateMachine.auditActionFor(PROCESSING_PAYMENT, false)).isEqualTo(ActionTypeEnum.SYSTEM_PAID);
        assertThat(InvoiceStateMachine.auditActionFor(PAID, false)).isEqualTo(ActionTypeEnum.SYSTEM_PAID);
        assertThat(InvoiceStateMachine.auditActionFor(FAILED, false)).isEqualTo(ActionTypeEnum.SYSTEM_FAILED);
        assertThat(InvoiceStateMachine.auditActionFor(VOID, true)).isEqualTo(ActionTypeEnum.USER_VOIDED);
    }

    @Test
    void auditActionFor_ingested_isRejected() {
        assertThatThrownBy(() -> InvoiceStateMachine.auditActionFor(INGESTED, true))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> InvoiceStateMachine.auditActionFor(INGESTED, false))
                .isInstanceOf(IllegalArgumentException.class);
    }
}

