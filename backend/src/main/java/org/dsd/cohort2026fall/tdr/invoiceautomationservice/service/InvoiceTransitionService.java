package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import lombok.extern.slf4j.Slf4j;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.BadRequestException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.InvalidStatusTransitionException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceStatus;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * The only place that changes an invoice's status after creation. Locks the row, checks the
 * transition against {@link InvoiceStateMachine} and writes the audit row in the same transaction.
 */
@Slf4j
@Service
@Transactional
public class InvoiceTransitionService {

    private final InvoiceRepository invoiceRepository;
    private final AuditLogService auditLogService;

    public InvoiceTransitionService(InvoiceRepository invoiceRepository, AuditLogService auditLogService) {
        this.invoiceRepository = invoiceRepository;
        this.auditLogService = auditLogService;
    }

    /** @return true if the status changed, false if the invoice was already in {@code to}. */
    public boolean transition(UUID invoiceId, InvoiceStatus to, UUID actorUserId, String reason) {
        InvoiceEntity invoice = invoiceRepository.findByIdForUpdate(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceId));
        InvoiceStatus from = InvoiceStatus.fromValue(invoice.getInvoiceStatus());

        if (from == to) {
            return false;
        }
        if (!InvoiceStateMachine.isAllowed(from, to)) {
            throw new InvalidStatusTransitionException(from, to);
        }
        if ((to == InvoiceStatus.PENDING_APPROVAL || to == InvoiceStatus.APPROVED)
                && invoice.getMapping() == null) {
            throw new BadRequestException("A property-vendor mapping is required before moving to " + to.getValue());
        }
        if (to == InvoiceStatus.APPROVED && actorUserId == null) {
            throw new BadRequestException("A human approver is required");
        }
        if (to == InvoiceStatus.FAILED && (reason == null || reason.isBlank())) {
            throw new BadRequestException("failureReason is required");
        }

        invoice.setInvoiceStatus(to.getValue());
        invoice.setUpdatedAt(OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS));
        invoiceRepository.save(invoice);

        boolean byUser = actorUserId != null && !InvoiceUploadService.SYSTEM_USER_ID.equals(actorUserId);
        auditLogService.record(
                invoiceId,
                byUser ? actorUserId : InvoiceUploadService.SYSTEM_USER_ID,
                InvoiceStateMachine.auditActionFor(to, byUser),
                "Status changed to " + to.getValue(),
                from.getValue(),
                to.getValue(),
                reason);
        return true;
    }

    /** Like {@link #transition} but an illegal transition is logged and ignored (for webhooks). */
    public boolean tryTransition(UUID invoiceId, InvoiceStatus to, UUID actorUserId, String reason) {
        try {
            return transition(invoiceId, to, actorUserId, reason);
        } catch (InvalidStatusTransitionException ex) {
            log.warn("Ignored illegal transition for invoice {}: {}", invoiceId, ex.getMessage());
            return false;
        }
    }
}

