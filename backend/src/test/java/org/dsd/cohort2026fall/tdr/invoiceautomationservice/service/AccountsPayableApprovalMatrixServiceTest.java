package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.BadRequestException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.time.OffsetDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountsPayableApprovalMatrixServiceTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    private AccountsPayableApprovalMatrixService service;

    private final UUID propertyId = UUID.randomUUID();
    private final UUID userUuid0 = UUID.randomUUID();
    private final UUID userUuid1 = UUID.randomUUID();
    private final UUID userUuid2 = UUID.randomUUID();
    private final UUID userUuid5 = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new AccountsPayableApprovalMatrixService(jdbcTemplate);
    }

    private AccountsPayableApprovalMatrixResponse createStep(int seq, String seat, String preset, Double varMax, Double fixedMax, UUID userUuid, String userName) {
        AccountsPayableApprovalMatrixResponse r = new AccountsPayableApprovalMatrixResponse();
        r.setMatrixUuid(UUID.randomUUID());
        r.setPropertyUuid(propertyId);
        r.setAccountsPayableApprovalSequence(seq);
        r.setAccountsPayableSeatSlug(seat);
        r.setSeatDisplayName(seat + " Name");
        r.setAccountsPayableThresholdSlug(preset);
        r.setVariableMax(varMax);
        r.setFixedAutoMax(fixedMax);
        r.setAssignedUserUuid(userUuid);
        r.setAssignedUserName(userName);
        r.setStatus("ACTIVE");
        return r;
    }

    @Test
    void calculateInvoiceRoutingQueue_lowAmount_stopsAtFirstCoveringStep() {
        // Setup property exists
        when(jdbcTemplate.queryForObject(contains("FROM properties"), eq(Integer.class), eq(propertyId)))
                .thenReturn(1);

        // Sequence 0 ($0), Sequence 1 ($2,500), Sequence 2 ($10,000), Sequence 5 (Unlimited)
        AccountsPayableApprovalMatrixResponse s0 = createStep(0, "ACCT_SEAT", "LIMIT_NONE", 0.0, 0.0, userUuid0, "Elena");
        AccountsPayableApprovalMatrixResponse s1 = createStep(1, "PM_SEAT", "LIMIT_LOW", 1000.0, 2500.0, userUuid1, "Marcus");
        AccountsPayableApprovalMatrixResponse s2 = createStep(2, "SPM_SEAT", "LIMIT_MID", 5000.0, 10000.0, userUuid2, "Sarah");
        AccountsPayableApprovalMatrixResponse s5 = createStep(5, "VP_SEAT", "LIMIT_UNLIMITED", 99999999.99, 99999999.99, userUuid5, "Victoria");

        when(jdbcTemplate.query(contains("FROM accounts_payable_approval_matrix"), any(RowMapper.class), eq(propertyId)))
                .thenReturn(List.of(s0, s1, s2, s5));

        // For user lookups during delegation check
        when(jdbcTemplate.queryForMap(contains("FROM users"), any(UUID.class)))
                .thenAnswer(inv -> {
                    UUID u = inv.getArgument(1);
                    Map<String, Object> map = new HashMap<>();
                    map.put("user_uuid", u);
                    map.put("user_name", "User-" + u);
                    map.put("email", u + "@example.com");
                    map.put("delegate_user_uuid", null);
                    map.put("delegate_expires_at", null);
                    map.put("status", "ACTIVE");
                    return map;
                });

        // $500 variable invoice -> covers at step 1 ($1000 variableMax)
        ApprovalQueueResponse queue = service.calculateInvoiceRoutingQueue(propertyId, 500.0, "VARIABLE");

        assertThat(queue.getSteps()).hasSize(2);
        assertThat(queue.getSteps().get(0).getSequence()).isEqualTo(0);
        assertThat(queue.getSteps().get(1).getSequence()).isEqualTo(1);
        assertThat(queue.getHasVacantStep()).isFalse();
    }

    @Test
    void calculateInvoiceRoutingQueue_highAmount_escalatesToSafetyNet() {
        when(jdbcTemplate.queryForObject(contains("FROM properties"), eq(Integer.class), eq(propertyId)))
                .thenReturn(1);

        AccountsPayableApprovalMatrixResponse s0 = createStep(0, "ACCT_SEAT", "LIMIT_NONE", 0.0, 0.0, userUuid0, "Elena");
        AccountsPayableApprovalMatrixResponse s1 = createStep(1, "PM_SEAT", "LIMIT_LOW", 1000.0, 2500.0, userUuid1, "Marcus");
        AccountsPayableApprovalMatrixResponse s2 = createStep(2, "SPM_SEAT", "LIMIT_MID", 5000.0, 10000.0, userUuid2, "Sarah");
        AccountsPayableApprovalMatrixResponse s5 = createStep(5, "VP_SEAT", "LIMIT_UNLIMITED", 99999999.99, 99999999.99, userUuid5, "Victoria");

        when(jdbcTemplate.query(contains("FROM accounts_payable_approval_matrix"), any(RowMapper.class), eq(propertyId)))
                .thenReturn(List.of(s0, s1, s2, s5));

        when(jdbcTemplate.queryForMap(contains("FROM users"), any(UUID.class)))
                .thenAnswer(inv -> {
                    UUID u = inv.getArgument(1);
                    Map<String, Object> map = new HashMap<>();
                    map.put("user_uuid", u);
                    map.put("user_name", "User-" + u);
                    map.put("email", u + "@example.com");
                    map.put("delegate_user_uuid", null);
                    map.put("delegate_expires_at", null);
                    map.put("status", "ACTIVE");
                    return map;
                });

        // $15,000 variable invoice -> steps 0, 1 ($1k), 2 ($5k) do not cover, escalates to step 5 (unlimited)
        ApprovalQueueResponse queue = service.calculateInvoiceRoutingQueue(propertyId, 15000.0, "VARIABLE");

        assertThat(queue.getSteps()).hasSize(4);
        assertThat(queue.getSteps().get(0).getSequence()).isEqualTo(0);
        assertThat(queue.getSteps().get(1).getSequence()).isEqualTo(1);
        assertThat(queue.getSteps().get(2).getSequence()).isEqualTo(2);
        assertThat(queue.getSteps().get(3).getSequence()).isEqualTo(5);
    }

    @Test
    void calculateInvoiceRoutingQueue_withVacantSeat_flagsHasVacantStep() {
        when(jdbcTemplate.queryForObject(contains("FROM properties"), eq(Integer.class), eq(propertyId)))
                .thenReturn(1);

        // Step 1 is vacant (no assigned user)
        AccountsPayableApprovalMatrixResponse s0 = createStep(0, "ACCT_SEAT", "LIMIT_NONE", 0.0, 0.0, userUuid0, "Elena");
        AccountsPayableApprovalMatrixResponse s1 = createStep(1, "PM_SEAT", "LIMIT_LOW", 1000.0, 2500.0, null, null);

        when(jdbcTemplate.query(contains("FROM accounts_payable_approval_matrix"), any(RowMapper.class), eq(propertyId)))
                .thenReturn(List.of(s0, s1));

        when(jdbcTemplate.queryForMap(contains("FROM users"), any(UUID.class)))
                .thenAnswer(inv -> {
                    UUID u = inv.getArgument(1);
                    Map<String, Object> map = new HashMap<>();
                    map.put("user_uuid", u);
                    map.put("user_name", "User-" + u);
                    map.put("email", u + "@example.com");
                    map.put("delegate_user_uuid", null);
                    map.put("delegate_expires_at", null);
                    map.put("status", "ACTIVE");
                    return map;
                });

        ApprovalQueueResponse queue = service.calculateInvoiceRoutingQueue(propertyId, 500.0, "VARIABLE");

        assertThat(queue.getHasVacantStep()).isTrue();
        assertThat(queue.getSteps().get(1).getIsVacant()).isTrue();
        assertThat(queue.getSteps().get(1).getUserName()).contains("VACANT");
    }

    private Map<String, Object> createUserMap(UUID uuid, String name, String email, UUID delegateUuid, OffsetDateTime expiresAt) {
        Map<String, Object> map = new HashMap<>();
        map.put("user_uuid", uuid);
        map.put("user_name", name);
        map.put("email", email);
        map.put("delegate_user_uuid", delegateUuid);
        map.put("delegate_expires_at", expiresAt);
        map.put("status", "ACTIVE");
        return map;
    }

    @Test
    void calculateInvoiceRoutingQueue_withActiveDelegate_resolvesProxy() {
        when(jdbcTemplate.queryForObject(contains("FROM properties"), eq(Integer.class), eq(propertyId)))
                .thenReturn(1);

        AccountsPayableApprovalMatrixResponse s0 = createStep(0, "ACCT_SEAT", "LIMIT_NONE", 0.0, 0.0, userUuid0, "Elena");
        when(jdbcTemplate.query(contains("FROM accounts_payable_approval_matrix"), any(RowMapper.class), eq(propertyId)))
                .thenReturn(List.of(s0));

        UUID proxyUuid = UUID.randomUUID();
        // User 0 delegates to proxyUuid until tomorrow
        when(jdbcTemplate.queryForMap(contains("FROM users"), eq(userUuid0)))
                .thenReturn(createUserMap(userUuid0, "Elena", "elena@example.com", proxyUuid, OffsetDateTime.now().plusDays(1)));

        when(jdbcTemplate.queryForMap(contains("FROM users"), eq(proxyUuid)))
                .thenReturn(createUserMap(proxyUuid, "Proxy User", "proxy@example.com", null, null));

        ApprovalQueueResponse queue = service.calculateInvoiceRoutingQueue(propertyId, 0.0, "VARIABLE");

        assertThat(queue.getSteps().get(0).getIsProxy()).isTrue();
        assertThat(queue.getSteps().get(0).getUserUuid()).isEqualTo(proxyUuid);
        assertThat(queue.getSteps().get(0).getUserName()).isEqualTo("Proxy User");
    }

    @Test
    void calculateInvoiceRoutingQueue_cyclicDelegation_terminatesGracefully() {
        when(jdbcTemplate.queryForObject(contains("FROM properties"), eq(Integer.class), eq(propertyId)))
                .thenReturn(1);

        AccountsPayableApprovalMatrixResponse s0 = createStep(0, "ACCT_SEAT", "LIMIT_NONE", 0.0, 0.0, userUuid0, "Elena");
        when(jdbcTemplate.query(contains("FROM accounts_payable_approval_matrix"), any(RowMapper.class), eq(propertyId)))
                .thenReturn(List.of(s0));

        UUID userA = userUuid0;
        UUID userB = UUID.randomUUID();

        // userA delegates to userB, userB delegates to userA
        when(jdbcTemplate.queryForMap(contains("FROM users"), eq(userA)))
                .thenReturn(createUserMap(userA, "User A", "a@example.com", userB, OffsetDateTime.now().plusDays(1)));

        when(jdbcTemplate.queryForMap(contains("FROM users"), eq(userB)))
                .thenReturn(createUserMap(userB, "User B", "b@example.com", userA, OffsetDateTime.now().plusDays(1)));

        ApprovalQueueResponse queue = service.calculateInvoiceRoutingQueue(propertyId, 0.0, "VARIABLE");

        // Terminates gracefully without loop
        assertThat(queue.getSteps()).hasSize(1);
    }

    @Test
    void deleteMatrixStep_sequence5_throwsBadRequest() {
        when(jdbcTemplate.queryForObject(contains("FROM properties"), eq(Integer.class), eq(propertyId)))
                .thenReturn(1);

        assertThatThrownBy(() -> service.deleteMatrixStep(propertyId, 5))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("fiduciary safety net");
    }

    @Test
    void addMatrixStep_sequence5NotUnlimited_throwsBadRequest() {
        when(jdbcTemplate.queryForObject(contains("FROM properties"), eq(Integer.class), eq(propertyId)))
                .thenReturn(1);

        AccountsPayableApprovalMatrixStepRequest req = new AccountsPayableApprovalMatrixStepRequest();
        req.setAccountsPayableApprovalSequence(5);
        req.setAccountsPayableSeatSlug("CORP_VP_OF_OPERATIONS");
        req.setAccountsPayableThresholdSlug("LIMIT_LOW");

        assertThatThrownBy(() -> service.addMatrixStep(propertyId, req))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("LIMIT_UNLIMITED");
    }
}

