package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.BadRequestException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.*;

@Service
@Transactional
public class AccountsPayableApprovalMatrixService {

    private final JdbcTemplate jdbcTemplate;

    public AccountsPayableApprovalMatrixService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<CorporateDesignationResponse> getAllDesignations() {
        String sql = "SELECT designation_slug, display_name, status FROM corporate_designations WHERE status = 'ACTIVE' ORDER BY designation_slug ASC";
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            CorporateDesignationResponse res = new CorporateDesignationResponse();
            res.setDesignationSlug(rs.getString("designation_slug"));
            res.setDisplayName(rs.getString("display_name"));
            res.setStatus(rs.getString("status"));
            return res;
        });
    }

    @Transactional(readOnly = true)
    public List<AccountsPayableSeatResponse> getAllSeats() {
        String sql = """
            SELECT aps.accounts_payable_seat_slug, aps.display_name, aps.status,
                   u.user_uuid, u.user_name, u.email
            FROM accounts_payable_seats aps
            LEFT JOIN accounts_payable_seat_assignment apsa 
                   ON aps.accounts_payable_seat_slug = apsa.accounts_payable_seat_slug AND apsa.status = 'ACTIVE'
            LEFT JOIN users u 
                   ON apsa.user_uuid = u.user_uuid AND u.status = 'ACTIVE'
            WHERE aps.status = 'ACTIVE'
            ORDER BY aps.accounts_payable_seat_slug ASC
        """;
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            AccountsPayableSeatResponse res = new AccountsPayableSeatResponse();
            res.setAccountsPayableSeatSlug(rs.getString("accounts_payable_seat_slug"));
            res.setDisplayName(rs.getString("display_name"));
            res.setStatus(rs.getString("status"));
            String userUuidStr = rs.getString("user_uuid");
            if (userUuidStr != null) {
                res.setAssignedUserUuid(UUID.fromString(userUuidStr));
                res.setAssignedUserName(rs.getString("user_name"));
                res.setAssignedUserEmail(rs.getString("email"));
            }
            return res;
        });
    }

    @Transactional(readOnly = true)
    public List<AccountsPayableThresholdPresetResponse> getAllPresets() {
        String sql = "SELECT accounts_payable_threshold_slug, variable_max, fixed_auto_max, status FROM accounts_payable_threshold_presets WHERE status = 'ACTIVE' ORDER BY variable_max ASC";
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            AccountsPayableThresholdPresetResponse res = new AccountsPayableThresholdPresetResponse();
            res.setAccountsPayableThresholdSlug(rs.getString("accounts_payable_threshold_slug"));
            res.setVariableMax(rs.getDouble("variable_max"));
            res.setFixedAutoMax(rs.getDouble("fixed_auto_max"));
            res.setStatus(rs.getString("status"));
            return res;
        });
    }

    public SeatAssignmentResponse assignSeatOccupant(String seatSlug, SeatAssignmentRequest request) {
        // 1. Verify seat exists
        Integer seatCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM accounts_payable_seats WHERE accounts_payable_seat_slug = ? AND status = 'ACTIVE'",
                Integer.class, seatSlug);
        if (seatCount == null || seatCount == 0) {
            throw new ResourceNotFoundException("Accounts payable seat not found: " + seatSlug);
        }

        // 2. Verify user exists
        Integer userCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE user_uuid = ? AND status = 'ACTIVE'",
                Integer.class, request.getUserUuid());
        if (userCount == null || userCount == 0) {
            throw new ResourceNotFoundException("User not found: " + request.getUserUuid());
        }

        // 3. Deactivate any existing active occupant of this seat
        jdbcTemplate.update(
                "UPDATE accounts_payable_seat_assignment SET status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP WHERE accounts_payable_seat_slug = ? AND status = 'ACTIVE'",
                seatSlug);

        // 4. Upsert assignment
        String upsertSql = """
            INSERT INTO accounts_payable_seat_assignment (accounts_payable_seat_slug, user_uuid, status, updated_at)
            VALUES (?, ?, 'ACTIVE', CURRENT_TIMESTAMP)
            ON CONFLICT (accounts_payable_seat_slug, user_uuid)
            DO UPDATE SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
        """;
        jdbcTemplate.update(upsertSql, seatSlug, request.getUserUuid());

        // 5. Query and return
        String query = """
            SELECT apsa.assignment_uuid, apsa.accounts_payable_seat_slug, apsa.user_uuid,
                   u.user_name, u.email, apsa.status
            FROM accounts_payable_seat_assignment apsa
            JOIN users u ON apsa.user_uuid = u.user_uuid
            WHERE apsa.accounts_payable_seat_slug = ? AND apsa.user_uuid = ?
        """;
        return jdbcTemplate.queryForObject(query, (rs, rowNum) -> {
            SeatAssignmentResponse res = new SeatAssignmentResponse();
            res.setAssignmentUuid(UUID.fromString(rs.getString("assignment_uuid")));
            res.setAccountsPayableSeatSlug(rs.getString("accounts_payable_seat_slug"));
            res.setUserUuid(UUID.fromString(rs.getString("user_uuid")));
            res.setUserName(rs.getString("user_name"));
            res.setUserEmail(rs.getString("email"));
            res.setStatus(rs.getString("status"));
            return res;
        }, seatSlug, request.getUserUuid());
    }

    public void vacateSeat(String seatSlug) {
        Integer seatCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM accounts_payable_seats WHERE accounts_payable_seat_slug = ? AND status = 'ACTIVE'",
                Integer.class, seatSlug);
        if (seatCount == null || seatCount == 0) {
            throw new ResourceNotFoundException("Accounts payable seat not found: " + seatSlug);
        }

        jdbcTemplate.update(
                "UPDATE accounts_payable_seat_assignment SET status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP WHERE accounts_payable_seat_slug = ? AND status = 'ACTIVE'",
                seatSlug);
    }

    @Transactional(readOnly = true)
    public List<AccountsPayableApprovalMatrixResponse> getPropertyApprovalMatrix(UUID propertyId) {
        verifyPropertyExists(propertyId);

        String sql = """
            SELECT pam.matrix_uuid, pam.property_uuid, pam.accounts_payable_seat_slug,
                   aps.display_name AS seat_display_name,
                   pam.accounts_payable_threshold_slug, apt.variable_max, apt.fixed_auto_max,
                   pam.accounts_payable_approval_sequence,
                   u.user_uuid, u.user_name, u.email, pam.status
            FROM accounts_payable_approval_matrix pam
            JOIN accounts_payable_seats aps ON pam.accounts_payable_seat_slug = aps.accounts_payable_seat_slug
            JOIN accounts_payable_threshold_presets apt ON pam.accounts_payable_threshold_slug = apt.accounts_payable_threshold_slug
            LEFT JOIN accounts_payable_seat_assignment apsa 
                   ON pam.accounts_payable_seat_slug = apsa.accounts_payable_seat_slug AND apsa.status = 'ACTIVE'
            LEFT JOIN users u 
                   ON apsa.user_uuid = u.user_uuid AND u.status = 'ACTIVE'
            WHERE pam.property_uuid = ? AND pam.status = 'ACTIVE'
            ORDER BY pam.accounts_payable_approval_sequence ASC
        """;
        return jdbcTemplate.query(sql, (rs, rowNum) -> mapMatrixRow(rs), propertyId);
    }

    public AccountsPayableApprovalMatrixResponse addMatrixStep(UUID propertyId, AccountsPayableApprovalMatrixStepRequest request) {
        verifyPropertyExists(propertyId);
        validateStepRequest(request.getAccountsPayableApprovalSequence(), request.getAccountsPayableThresholdSlug());

        // Validate seat & preset exist
        verifySeatExists(request.getAccountsPayableSeatSlug());
        verifyPresetExists(request.getAccountsPayableThresholdSlug());

        String upsertSql = """
            INSERT INTO accounts_payable_approval_matrix 
            (property_uuid, accounts_payable_seat_slug, accounts_payable_threshold_slug, accounts_payable_approval_sequence, status, updated_at)
            VALUES (?, ?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP)
            ON CONFLICT (property_uuid, accounts_payable_approval_sequence) WHERE (status = 'ACTIVE')
            DO UPDATE SET accounts_payable_seat_slug = EXCLUDED.accounts_payable_seat_slug,
                          accounts_payable_threshold_slug = EXCLUDED.accounts_payable_threshold_slug,
                          status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
        """;
        jdbcTemplate.update(upsertSql, propertyId, request.getAccountsPayableSeatSlug(),
                request.getAccountsPayableThresholdSlug(), request.getAccountsPayableApprovalSequence());

        return fetchMatrixStep(propertyId, request.getAccountsPayableApprovalSequence());
    }

    public AccountsPayableApprovalMatrixResponse updateMatrixStep(UUID propertyId, Integer sequence, AccountsPayableApprovalMatrixStepRequest request) {
        verifyPropertyExists(propertyId);
        validateStepRequest(sequence, request.getAccountsPayableThresholdSlug());
        verifySeatExists(request.getAccountsPayableSeatSlug());
        verifyPresetExists(request.getAccountsPayableThresholdSlug());

        String updateSql = """
            UPDATE accounts_payable_approval_matrix
            SET accounts_payable_seat_slug = ?, accounts_payable_threshold_slug = ?, updated_at = CURRENT_TIMESTAMP, status = 'ACTIVE'
            WHERE property_uuid = ? AND accounts_payable_approval_sequence = ?
        """;
        int rows = jdbcTemplate.update(updateSql, request.getAccountsPayableSeatSlug(),
                request.getAccountsPayableThresholdSlug(), propertyId, sequence);
        if (rows == 0) {
            throw new ResourceNotFoundException("Matrix step " + sequence + " not found for property: " + propertyId);
        }

        return fetchMatrixStep(propertyId, sequence);
    }

    public void deleteMatrixStep(UUID propertyId, Integer sequence) {
        verifyPropertyExists(propertyId);
        if (sequence == 5) {
            throw new BadRequestException("Sequence step 5 is the permanent fiduciary safety net and cannot be deleted");
        }

        int rows = jdbcTemplate.update(
                "UPDATE accounts_payable_approval_matrix SET status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP WHERE property_uuid = ? AND accounts_payable_approval_sequence = ? AND status = 'ACTIVE'",
                propertyId, sequence);
        if (rows == 0) {
            throw new ResourceNotFoundException("Matrix step " + sequence + " not found for property: " + propertyId);
        }
    }

    @Transactional(readOnly = true)
    public ApprovalQueueResponse calculateInvoiceRoutingQueue(UUID propertyId, Double grossAmount, String costType) {
        verifyPropertyExists(propertyId);

        boolean isFixed = "FIXED_MONTHLY".equalsIgnoreCase(costType);

        List<AccountsPayableApprovalMatrixResponse> allSteps = getPropertyApprovalMatrix(propertyId);

        List<ApprovalQueueStepResponse> queueSteps = new ArrayList<>();
        boolean hasVacantStep = false;

        for (AccountsPayableApprovalMatrixResponse step : allSteps) {
            ApprovalQueueStepResponse qStep = new ApprovalQueueStepResponse();
            qStep.setSequence(step.getAccountsPayableApprovalSequence());
            qStep.setSeatSlug(step.getAccountsPayableSeatSlug());
            qStep.setSeatDisplayName(step.getSeatDisplayName());
            qStep.setThresholdSlug(step.getAccountsPayableThresholdSlug());
            qStep.setVariableMax(step.getVariableMax());
            qStep.setFixedAutoMax(step.getFixedAutoMax());

            if (step.getAssignedUserUuid() == null) {
                qStep.setIsVacant(true);
                qStep.setIsProxy(false);
                qStep.setUserName("VACANT: " + step.getSeatDisplayName());
                hasVacantStep = true;
            } else {
                // Resolve potential delegation
                DelegationResolution resolved = resolveDelegation(step.getAssignedUserUuid());
                if (resolved == null || resolved.userUuid == null) {
                    qStep.setIsVacant(true);
                    qStep.setIsProxy(false);
                    qStep.setUserName("VACANT: " + step.getSeatDisplayName());
                    hasVacantStep = true;
                } else {
                    qStep.setIsVacant(false);
                    qStep.setUserUuid(resolved.userUuid);
                    qStep.setUserName(resolved.userName);
                    qStep.setUserEmail(resolved.userEmail);
                    qStep.setIsProxy(resolved.isProxy);
                }
            }

            queueSteps.add(qStep);

            // Slicing check: does this step cover the gross amount?
            double effectiveLimit = isFixed ? (step.getFixedAutoMax() != null ? step.getFixedAutoMax() : 0.0)
                    : (step.getVariableMax() != null ? step.getVariableMax() : 0.0);

            if (effectiveLimit >= grossAmount) {
                // Slicing complete: approval chain stops at this authorized clearance tier
                break;
            }
        }

        ApprovalQueueResponse response = new ApprovalQueueResponse();
        response.setPropertyUuid(propertyId);
        response.setGrossAmount(grossAmount);
        response.setCostType(isFixed ? "FIXED_MONTHLY" : "VARIABLE");
        response.setHasVacantStep(hasVacantStep);
        response.setSteps(queueSteps);
        return response;
    }

    private static class DelegationResolution {
        UUID userUuid;
        String userName;
        String userEmail;
        boolean isProxy;
    }

    private DelegationResolution resolveDelegation(UUID initialUserUuid) {
        Set<UUID> visited = new HashSet<>();
        UUID current = initialUserUuid;
        boolean isProxy = false;

        while (current != null && visited.add(current)) {
            try {
                String sql = "SELECT user_uuid, user_name, email, delegate_user_uuid, delegate_expires_at FROM users WHERE user_uuid = ? AND status = 'ACTIVE'";
                Map<String, Object> row = jdbcTemplate.queryForMap(sql, current);
                UUID delegateUuid = (UUID) row.get("delegate_user_uuid");
                OffsetDateTime expiresAt = (OffsetDateTime) row.get("delegate_expires_at");

                if (delegateUuid != null && expiresAt != null && expiresAt.isAfter(OffsetDateTime.now())) {
                    current = delegateUuid;
                    isProxy = true;
                } else {
                    DelegationResolution res = new DelegationResolution();
                    res.userUuid = (UUID) row.get("user_uuid");
                    res.userName = (String) row.get("user_name");
                    res.userEmail = (String) row.get("email");
                    res.isProxy = isProxy;
                    return res;
                }
            } catch (EmptyResultDataAccessException e) {
                break;
            }
        }

        // Fallback: return initial user details if active
        DelegationResolution fallback = new DelegationResolution();
        fallback.userUuid = initialUserUuid;
        fallback.isProxy = false;
        try {
            Map<String, Object> orig = jdbcTemplate.queryForMap(
                    "SELECT user_name, email, status FROM users WHERE user_uuid = ?", initialUserUuid);
            if (!"ACTIVE".equals(orig.get("status"))) {
                return null;
            }
            fallback.userName = (String) orig.get("user_name");
            fallback.userEmail = (String) orig.get("email");
        } catch (EmptyResultDataAccessException ignored) {
            return null;
        }
        return fallback;
    }

    private void verifyPropertyExists(UUID propertyId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM properties WHERE property_uuid = ? AND status = 'ACTIVE'",
                Integer.class, propertyId);
        if (count == null || count == 0) {
            throw new ResourceNotFoundException("Property not found: " + propertyId);
        }
    }

    private void verifySeatExists(String seatSlug) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM accounts_payable_seats WHERE accounts_payable_seat_slug = ? AND status = 'ACTIVE'",
                Integer.class, seatSlug);
        if (count == null || count == 0) {
            throw new ResourceNotFoundException("Seat not found: " + seatSlug);
        }
    }

    private void verifyPresetExists(String presetSlug) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM accounts_payable_threshold_presets WHERE accounts_payable_threshold_slug = ? AND status = 'ACTIVE'",
                Integer.class, presetSlug);
        if (count == null || count == 0) {
            throw new ResourceNotFoundException("Threshold preset not found: " + presetSlug);
        }
    }

    private void validateStepRequest(Integer sequence, String presetSlug) {
        if (sequence == null || sequence < 0 || sequence > 5) {
            throw new BadRequestException("accounts_payable_approval_sequence must be between 0 and 5");
        }
        if (sequence == 5 && !"LIMIT_UNLIMITED".equals(presetSlug)) {
            throw new BadRequestException("Sequence step 5 is locked to LIMIT_UNLIMITED for fiduciary safety");
        }
    }

    private AccountsPayableApprovalMatrixResponse fetchMatrixStep(UUID propertyId, Integer sequence) {
        String sql = """
            SELECT pam.matrix_uuid, pam.property_uuid, pam.accounts_payable_seat_slug,
                   aps.display_name AS seat_display_name,
                   pam.accounts_payable_threshold_slug, apt.variable_max, apt.fixed_auto_max,
                   pam.accounts_payable_approval_sequence,
                   u.user_uuid, u.user_name, u.email, pam.status
            FROM accounts_payable_approval_matrix pam
            JOIN accounts_payable_seats aps ON pam.accounts_payable_seat_slug = aps.accounts_payable_seat_slug
            JOIN accounts_payable_threshold_presets apt ON pam.accounts_payable_threshold_slug = apt.accounts_payable_threshold_slug
            LEFT JOIN accounts_payable_seat_assignment apsa 
                   ON pam.accounts_payable_seat_slug = apsa.accounts_payable_seat_slug AND apsa.status = 'ACTIVE'
            LEFT JOIN users u 
                   ON apsa.user_uuid = u.user_uuid AND u.status = 'ACTIVE'
            WHERE pam.property_uuid = ? AND pam.accounts_payable_approval_sequence = ? AND pam.status = 'ACTIVE'
        """;
        return jdbcTemplate.queryForObject(sql, (rs, rowNum) -> mapMatrixRow(rs), propertyId, sequence);
    }

    private AccountsPayableApprovalMatrixResponse mapMatrixRow(ResultSet rs) throws SQLException {
        AccountsPayableApprovalMatrixResponse row = new AccountsPayableApprovalMatrixResponse();
        row.setMatrixUuid(UUID.fromString(rs.getString("matrix_uuid")));
        row.setPropertyUuid(UUID.fromString(rs.getString("property_uuid")));
        row.setAccountsPayableSeatSlug(rs.getString("accounts_payable_seat_slug"));
        row.setSeatDisplayName(rs.getString("seat_display_name"));
        row.setAccountsPayableThresholdSlug(rs.getString("accounts_payable_threshold_slug"));
        row.setVariableMax(rs.getDouble("variable_max"));
        row.setFixedAutoMax(rs.getDouble("fixed_auto_max"));
        row.setAccountsPayableApprovalSequence(rs.getInt("accounts_payable_approval_sequence"));
        String userUuidStr = rs.getString("user_uuid");
        if (userUuidStr != null) {
            row.setAssignedUserUuid(UUID.fromString(userUuidStr));
            row.setAssignedUserName(rs.getString("user_name"));
            row.setAssignedUserEmail(rs.getString("email"));
        }
        row.setStatus(rs.getString("status"));
        return row;
    }
}

