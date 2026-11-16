package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.AuditLogCreateRequest.ActionTypeEnum;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceStatus;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

import static org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceStatus.*;

/** Pure, stateless rules for which invoice status changes are allowed. */
public final class InvoiceStateMachine {

    private static final Map<InvoiceStatus, Set<InvoiceStatus>> ALLOWED = new EnumMap<>(InvoiceStatus.class);

    static {
        ALLOWED.put(INGESTED, EnumSet.of(PENDING_MAPPING, PENDING_APPROVAL, FAILED, VOID));
        ALLOWED.put(PENDING_MAPPING, EnumSet.of(PENDING_APPROVAL, FAILED, VOID));
        ALLOWED.put(PENDING_APPROVAL, EnumSet.of(APPROVED, PENDING_MAPPING, FAILED, VOID));
        ALLOWED.put(APPROVED, EnumSet.of(PROCESSING_PAYMENT, PAID, FAILED, VOID));
        ALLOWED.put(PROCESSING_PAYMENT, EnumSet.of(PAID, FAILED));
        ALLOWED.put(FAILED, EnumSet.of(PENDING_MAPPING, PENDING_APPROVAL, VOID));
        ALLOWED.put(PAID, EnumSet.noneOf(InvoiceStatus.class));
        ALLOWED.put(VOID, EnumSet.noneOf(InvoiceStatus.class));
    }

    private InvoiceStateMachine() {
    }

    public static boolean isAllowed(InvoiceStatus from, InvoiceStatus to) {
        return ALLOWED.get(from).contains(to);
    }

    public static Set<InvoiceStatus> allowedFrom(InvoiceStatus from) {
        return EnumSet.copyOf(ALLOWED.get(from));
    }

    public static ActionTypeEnum auditActionFor(InvoiceStatus to, boolean byUser) {
        return switch (to) {
            case PENDING_MAPPING -> byUser ? ActionTypeEnum.USER_IDENTIFIED : ActionTypeEnum.SYSTEM_IDENTIFIED;
            case PENDING_APPROVAL -> byUser ? ActionTypeEnum.USER_MATCHED : ActionTypeEnum.SYSTEM_MATCHED;
            case APPROVED -> byUser ? ActionTypeEnum.USER_APPROVED : ActionTypeEnum.SYSTEM_APPROVED;
            case PROCESSING_PAYMENT, PAID -> byUser ? ActionTypeEnum.USER_PAID : ActionTypeEnum.SYSTEM_PAID;
            case FAILED -> byUser ? ActionTypeEnum.USER_FAILED : ActionTypeEnum.SYSTEM_FAILED;
            case VOID -> byUser ? ActionTypeEnum.USER_VOIDED : ActionTypeEnum.SYSTEM_VOIDED;
            case INGESTED -> throw new IllegalArgumentException("Nothing transitions into INGESTED");
        };
    }
}
