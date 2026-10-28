package org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLogsEntity {

    @Id
    @Column(name = "audit_uuid", updatable = false, nullable = false)
    private UUID auditUuid;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_uuid", nullable = false)
    private InvoiceEntity invoice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_uuid", nullable = false)
    private UserEntity user;

    @Column(name = "action_type", length = 255)
    private String actionType;

    @Column(name = "action_taken", length = 225)
    private String actionTaken;

    @Column(name = "from_state", length = 255)
    private String fromState;

    @Column(name = "to_state", length = 255)
    private String toState;

    @Column(name = "notes", length = 3000)
    private String notes;

    @Builder.Default
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();;

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();;
}
