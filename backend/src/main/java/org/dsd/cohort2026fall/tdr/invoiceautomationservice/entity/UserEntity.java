package org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserEntity {

    @Id
    @Column(name = "user_uuid", updatable = false, nullable = false)
    private UUID userId;

    @Column(name = "user_name", nullable = false)
    private String userName;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "delegate_user_uuid")
    private UUID delegateUserUuid;

    @Column(name = "delegate_expires_at")
    private OffsetDateTime delegateExpiresAt;

    @Builder.Default
    @Column(name = "status", nullable = false)
    private String status = "ACTIVE";

    @Builder.Default
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
