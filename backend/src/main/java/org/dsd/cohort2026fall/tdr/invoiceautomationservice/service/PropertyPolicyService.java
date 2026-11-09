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
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class PropertyPolicyService {

    private final JdbcTemplate jdbcTemplate;

    public PropertyPolicyService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<RoleResponse> getAllRoles() {
        String sql = "SELECT role_slug, display_name, description, status FROM roles WHERE status = 'ACTIVE' ORDER BY role_slug ASC";
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            RoleResponse r = new RoleResponse();
            r.setRoleSlug(rs.getString("role_slug"));
            r.setDisplayName(rs.getString("display_name"));
            r.setDescription(rs.getString("description"));
            r.setStatus(rs.getString("status"));
            return r;
        });
    }

    @Transactional(readOnly = true)
    public List<CorporatePolicyTierResponse> getAllPolicyTiers() {
        String sql = "SELECT tier_slug, display_name, allowed_role, variable_max, fixed_auto_max, status " +
                     "FROM corporate_policy_tiers WHERE status = 'ACTIVE' ORDER BY variable_max ASC";
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            CorporatePolicyTierResponse t = new CorporatePolicyTierResponse();
            t.setTierSlug(rs.getString("tier_slug"));
            t.setDisplayName(rs.getString("display_name"));
            t.setAllowedRole(rs.getString("allowed_role"));
            t.setVariableMax(rs.getDouble("variable_max"));
            t.setFixedAutoMax(rs.getDouble("fixed_auto_max"));
            t.setStatus(rs.getString("status"));
            return t;
        });
    }

    @Transactional(readOnly = true)
    public List<PropertyUserPolicyResponse> getPropertyUserPolicies(UUID propertyId) {
        String sql = """
            SELECT pup.property_uuid, pup.user_uuid, u.user_name, u.email, pup.user_role,
                   pup.tier_slug, cpt.display_name AS tier_display_name,
                   cpt.variable_max, cpt.fixed_auto_max, pup.status,
                   pup.created_at, pup.updated_at
            FROM property_user_policies pup
            JOIN users u ON pup.user_uuid = u.user_uuid AND u.status = 'ACTIVE'
            JOIN corporate_policy_tiers cpt ON pup.tier_slug = cpt.tier_slug
            WHERE pup.property_uuid = ? AND pup.status = 'ACTIVE'
            ORDER BY cpt.variable_max ASC, u.user_name ASC
        """;
        return jdbcTemplate.query(sql, (rs, rowNum) -> mapPropertyUserPolicy(rs), propertyId);
    }

    public PropertyUserPolicyResponse assignUserPolicy(UUID propertyId, UUID userUuid, PropertyUserPolicyAssignmentRequest request) {
        if (request.getUserUuid() != null && !userUuid.equals(request.getUserUuid())) {
            throw new BadRequestException("Path userUuid (" + userUuid + ") does not match body userUuid (" + request.getUserUuid() + ")");
        }

        // 1. Verify property exists
        Integer propCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM properties WHERE property_uuid = ? AND status = 'ACTIVE'", Integer.class, propertyId);
        if (propCount == null || propCount == 0) {
            throw new ResourceNotFoundException("Property not found: " + propertyId);
        }

        // 2. Fetch user's global role
        String userRole;
        try {
            userRole = jdbcTemplate.queryForObject(
                    "SELECT global_role FROM users WHERE user_uuid = ? AND status = 'ACTIVE'", String.class, userUuid);
        } catch (EmptyResultDataAccessException e) {
            throw new ResourceNotFoundException("User not found: " + userUuid);
        }

        // 3. Verify policy tier is allowed for this role
        Integer tierMatch = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM corporate_policy_tiers WHERE tier_slug = ? AND allowed_role = ? AND status = 'ACTIVE'",
                Integer.class, request.getTierSlug(), userRole);
        if (tierMatch == null || tierMatch == 0) {
            throw new BadRequestException("Policy tier '" + request.getTierSlug() + "' is not legally allowed for role '" + userRole + "'");
        }

        // 4. Upsert assignment
        String upsertSql = """
            INSERT INTO property_user_policies (property_uuid, user_uuid, user_role, tier_slug, status, updated_at)
            VALUES (?, ?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP)
            ON CONFLICT (property_uuid, user_uuid)
            DO UPDATE SET tier_slug = EXCLUDED.tier_slug, user_role = EXCLUDED.user_role, status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
        """;
        jdbcTemplate.update(upsertSql, propertyId, userUuid, userRole, request.getTierSlug());

        // 5. Query and return updated record
        String fetchSql = """
            SELECT pup.property_uuid, pup.user_uuid, u.user_name, u.email, pup.user_role,
                   pup.tier_slug, cpt.display_name AS tier_display_name,
                   cpt.variable_max, cpt.fixed_auto_max, pup.status,
                   pup.created_at, pup.updated_at
            FROM property_user_policies pup
            JOIN users u ON pup.user_uuid = u.user_uuid
            JOIN corporate_policy_tiers cpt ON pup.tier_slug = cpt.tier_slug
            WHERE pup.property_uuid = ? AND pup.user_uuid = ?
        """;
        return jdbcTemplate.queryForObject(fetchSql, (rs, rowNum) -> mapPropertyUserPolicy(rs), propertyId, userUuid);
    }

    public void removeUserPolicy(UUID propertyId, UUID userUuid) {
        int updated = jdbcTemplate.update(
                "UPDATE property_user_policies SET status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP WHERE property_uuid = ? AND user_uuid = ? AND status = 'ACTIVE'",
                propertyId, userUuid);
        if (updated == 0) {
            throw new ResourceNotFoundException("Property user policy assignment not found for property " + propertyId + " and user " + userUuid);
        }
    }

    private PropertyUserPolicyResponse mapPropertyUserPolicy(ResultSet rs) throws SQLException {
        PropertyUserPolicyResponse res = new PropertyUserPolicyResponse();
        res.setPropertyUuid((UUID) rs.getObject("property_uuid"));
        res.setUserUuid((UUID) rs.getObject("user_uuid"));
        res.setUserName(rs.getString("user_name"));
        res.setUserEmail(rs.getString("email"));
        res.setUserRole(rs.getString("user_role"));
        res.setTierSlug(rs.getString("tier_slug"));
        res.setTierDisplayName(rs.getString("tier_display_name"));
        res.setVariableMax(rs.getDouble("variable_max"));
        res.setFixedAutoMax(rs.getDouble("fixed_auto_max"));
        res.setStatus(rs.getString("status"));

        java.sql.Timestamp createdTs = rs.getTimestamp("created_at");
        if (createdTs != null) {
            res.setCreatedAt(OffsetDateTime.ofInstant(createdTs.toInstant(), ZoneOffset.UTC));
        }
        java.sql.Timestamp updatedTs = rs.getTimestamp("updated_at");
        if (updatedTs != null) {
            res.setUpdatedAt(OffsetDateTime.ofInstant(updatedTs.toInstant(), ZoneOffset.UTC));
        }
        return res;
    }
}

