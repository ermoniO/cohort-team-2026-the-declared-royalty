# Financial Approval Policy Profiles & Role Clearance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the database schema, OpenAPI contracts, Spring Boot backend services, and React UI for Commercial Real Estate (CRE) financial approval policy profiles (`roles`, `corporate_policy_tiers`, and `property_user_policies`), enforcing composite foreign key fiduciary constraints at the database level.

**Architecture:** PostgreSQL schema enforces composite integrity: users hold a global CRE base role, corporate policy tiers define clearing limits per role (`variable_max`, `fixed_auto_max`), and `property_user_policies` binds users to properties with dual composite foreign keys ensuring the assigned tier is legally allowed for the user's role. Backend leverages OpenAPI generator, Spring Boot 3 with direct `JdbcTemplate` queries for reference/junction data, and the frontend regenerates typed contracts with `openapi-typescript` and renders the policy assignment matrix.

**Tech Stack:** PostgreSQL / Flyway, Java 21, Spring Boot 3, Spring JDBC (`JdbcTemplate`), OpenAPI 3.0, React 19, TypeScript, `openapi-typescript`, `openapi-fetch`, Tailwind CSS, Lucide icons.

**Spec:** [`docs/superpowers/plans/Invoice-Approval-Spec.md`](file:///Users/spira/Documents/Projects/invoice-automation-service/docs/superpowers/plans/Invoice-Approval-Spec.md)

---

## Global Constraints

- Preserve `user_name` column in `users` table; do not split into `first_name` and `last_name`.
- Use existing `property_categories` (`category_code`) and `property_gl_accounts` (`gl_code`, `property_uuid`); do not recreate or rename to `property_types` or `property_gl_codes`.
- Do not create JPA `@Entity` or `JpaRepository` for reference/junction tables (`roles`, `corporate_policy_tiers`, `property_user_policies`); follow the established metadata pattern querying directly with `JdbcTemplate` in `PropertyPolicyService`.
- All tables must include logical soft delete support: `status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE'` with check constraint `IN ('ACTIVE', 'INACTIVE')`. Queries must filter `WHERE status = 'ACTIVE'`.
- Composite foreign key constraints in `property_user_policies` must strictly enforce:
  1. `(user_uuid, user_role)` references `users(user_uuid, role) ON DELETE CASCADE`.
  2. `(tier_slug, user_role)` references `corporate_policy_tiers(tier_slug, allowed_role) ON DELETE RESTRICT`.
- Frontend types must be generated via `npm run generate:api`; do not hand-write server DTO shapes.
- Scope boundary: This plan implements configuration rules, role tiers, and assignment profiles; actual invoice execution and multi-tier approval routing algorithms are out of scope for this plan.

---

## Review Focus

1. **Composite Role Legality Enforcement:** Verify that attempting to assign an operative to a policy tier not matching their global role (e.g. attempting to assign a `PROPERTY_MANAGER` to `TIER_3_HIGH_RD`) is rejected at the database level by `fk_enforce_policy_role_legality`.
2. **User Identity Matching:** Verify that modifying or mismatching `user_role` in `property_user_policies` fails constraint `fk_enforce_user_identity_match`.
3. **Dynamic Filtering in UI:** Verify that the policy selection dropdown in `PayerPolicyRules` dynamically filters tiers strictly to those permitted by the selected operative's `role`.
4. **Seed Data Alignment:** Verify that `R__seed_test_data.sql` and `V4__seed_system_user.sql` seed valid CRE roles, policy tiers, and sample assignments without constraint violations.
5. **OpenAPI Root Layout Integrity:** Verify that `backend/src/main/resources/openapi/openapi.yaml` remains modular with fragments and passes `OpenApiSpecStructureTest`.

---

## Tasks

### Task 1: Database Migration & Seed Data Updates

**Files:**
- Modify: `backend/src/main/resources/db/migration/V1__initial_schema.sql`
- Modify: `backend/src/main/resources/db/migration/V4__seed_system_user.sql`
- Modify: `backend/src/main/resources/db/migration/R__seed_test_data.sql`

- [x] **Step 1: Update `V1__initial_schema.sql`**
  - Add `roles` table before `users`:
    ```sql
    CREATE TABLE roles
    (
        role_slug    VARCHAR(50) PRIMARY KEY,
        display_name VARCHAR(100) NOT NULL,
        description  TEXT,
        status       VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
        created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT check_role_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
        CONSTRAINT check_role_slug CHECK (role_slug IN ('ADMIN', 'ACCOUNTANT', 'PROPERTY_MANAGER', 'SENIOR_PROPERTY_MANAGER', 'REGIONAL_DIRECTOR', 'VICE_PRESIDENT'))
    );
    ```
  - Update `users` table:
    - Change `role` to `VARCHAR(50) NOT NULL REFERENCES roles(role_slug)`.
    - Add `CONSTRAINT unique_user_role_bridge UNIQUE (user_uuid, role)`.
    - Add `email` UNIQUE constraint.
  - Add `corporate_policy_tiers` table:
    ```sql
    CREATE TABLE corporate_policy_tiers
    (
        tier_slug         VARCHAR(50) PRIMARY KEY,
        display_name      VARCHAR(100) NOT NULL,
        allowed_role      VARCHAR(50) NOT NULL REFERENCES roles(role_slug),
        variable_max      NUMERIC(12, 2) NOT NULL,
        fixed_auto_max    NUMERIC(12, 2) NOT NULL,
        status            VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
        created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT check_policy_tier_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
        CONSTRAINT check_policy_tier_slug CHECK (tier_slug IN ('TIER_NONE_ACCT', 'TIER_1_LOW_PM', 'TIER_2_MID_SPM', 'TIER_3_HIGH_RD', 'TIER_4_UNLIMITED_VP')),
        CONSTRAINT unique_tier_role_bridge UNIQUE (tier_slug, allowed_role)
    );
    ```
  - Add `property_user_policies` table:
    ```sql
    CREATE TABLE property_user_policies
    (
        property_uuid     UUID NOT NULL REFERENCES properties(property_uuid) ON DELETE CASCADE,
        user_uuid         UUID NOT NULL,
        user_role         VARCHAR(50) NOT NULL,
        tier_slug         VARCHAR(50) NOT NULL,
        status            VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
        created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (property_uuid, user_uuid),
        CONSTRAINT check_prop_user_policy_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
        CONSTRAINT fk_enforce_user_identity_match
            FOREIGN KEY (user_uuid, user_role)
            REFERENCES users(user_uuid, role) ON DELETE CASCADE,
        CONSTRAINT fk_enforce_policy_role_legality
            FOREIGN KEY (tier_slug, user_role)
            REFERENCES corporate_policy_tiers(tier_slug, allowed_role) ON DELETE RESTRICT
    );
    ```

- [x] **Step 2: Update `V4__seed_system_user.sql`**
  - Ensure `System` user inserts with role `'ADMIN'`.

- [x] **Step 3: Update `R__seed_test_data.sql`**
  - Add deletions for child tables: `DELETE FROM property_user_policies; DELETE FROM corporate_policy_tiers; DELETE FROM roles;`.
  - Seed static CRE roles into `roles` (`ADMIN`, `ACCOUNTANT`, `PROPERTY_MANAGER`, `SENIOR_PROPERTY_MANAGER`, `REGIONAL_DIRECTOR`, `VICE_PRESIDENT`).
  - Seed standard tiers into `corporate_policy_tiers`:
    - `TIER_NONE_ACCT` (`ACCOUNTANT`, 0.00, 0.00)
    - `TIER_1_LOW_PM` (`PROPERTY_MANAGER`, 1000.00, 2500.00)
    - `TIER_2_MID_SPM` (`SENIOR_PROPERTY_MANAGER`, 5000.00, 10000.00)
    - `TIER_3_HIGH_RD` (`REGIONAL_DIRECTOR`, 25000.00, 50000.00)
    - `TIER_4_UNLIMITED_VP` (`VICE_PRESIDENT`, 99999999.99, 99999999.99)
  - Seed representative CRE users in `users`:
    - `Sarah Jenkins` (`s.jenkins@pmfirm.com`, `SENIOR_PROPERTY_MANAGER`)
    - `Marcus Vance` (`m.vance@pmfirm.com`, `PROPERTY_MANAGER`)
    - `Elena Rostova` (`e.rostova@pmfirm.com`, `ACCOUNTANT`)
    - `David Sterling` (`d.sterling@pmfirm.com`, `REGIONAL_DIRECTOR`)
    - `Victoria Chen` (`v.chen@pmfirm.com`, `VICE_PRESIDENT`)
  - Seed initial `property_user_policies` assignments on `Grandview Office Tower`.

---

### Task 2: OpenAPI Specification Updates

**Files:**
- Create: `backend/src/main/resources/openapi/components/schemas/RoleResponse.yaml`
- Create: `backend/src/main/resources/openapi/components/schemas/CorporatePolicyTierResponse.yaml`
- Create: `backend/src/main/resources/openapi/components/schemas/PropertyUserPolicyResponse.yaml`
- Create: `backend/src/main/resources/openapi/components/schemas/PropertyUserPolicyAssignmentRequest.yaml`
- Create: `backend/src/main/resources/openapi/paths/roles.yaml`
- Create: `backend/src/main/resources/openapi/paths/corporate_policy_tiers.yaml`
- Create: `backend/src/main/resources/openapi/paths/property_user_policies.yaml`
- Modify: `backend/src/main/resources/openapi/openapi.yaml`

- [x] **Step 1: Create schema fragments**
  - Define `RoleResponse`: `roleSlug`, `displayName`, `description`, `status`.
  - Define `CorporatePolicyTierResponse`: `tierSlug`, `displayName`, `allowedRole`, `variableMax`, `fixedAutoMax`, `status`.
  - Define `PropertyUserPolicyResponse`: `propertyUuid`, `userUuid`, `userName`, `userEmail`, `userRole`, `tierSlug`, `tierDisplayName`, `variableMax`, `fixedAutoMax`, `status`, `createdAt`, `updatedAt`.
  - Define `PropertyUserPolicyAssignmentRequest`: `userUuid`, `tierSlug`.

- [x] **Step 2: Create path fragments**
  - `roles.yaml`: `GET /api/v1/roles` -> `List<RoleResponse>`.
  - `corporate_policy_tiers.yaml`: `GET /api/v1/corporate-policy-tiers` -> `List<CorporatePolicyTierResponse>`.
  - `property_user_policies.yaml`:
    - `GET /api/v1/properties/{propertyId}/user-policies` -> `List<PropertyUserPolicyResponse>`.
    - `PUT /api/v1/properties/{propertyId}/user-policies/{userUuid}` -> body `PropertyUserPolicyAssignmentRequest`, returns `PropertyUserPolicyResponse`.
    - `DELETE /api/v1/properties/{propertyId}/user-policies/{userUuid}` -> 204 No Content.

- [x] **Step 3: Register fragments in `openapi.yaml`**
  - Add routes and components to `openapi.yaml`. Verify lines stay within structure limits.

---

### Task 3: Backend Services, Controllers & Testing

**Files:**
- Create: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/service/PropertyPolicyService.java`
- Create: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/controller/PropertyPolicyController.java`
- Create: `backend/src/test/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/controller/PropertyPolicyControllerTest.java`

- [x] **Step 1: Implement `PropertyPolicyService.java`**
  - `getAllRoles()`: direct `JdbcTemplate` query on `roles WHERE status = 'ACTIVE' ORDER BY role_slug`.
  - `getAllPolicyTiers()`: direct `JdbcTemplate` query on `corporate_policy_tiers WHERE status = 'ACTIVE' ORDER BY variable_max ASC`.
  - `getPropertyUserPolicies(UUID propertyId)`: join `property_user_policies` with `users` and `corporate_policy_tiers` where `property_uuid = ? AND status = 'ACTIVE'`.
  - `assignUserPolicy(UUID propertyId, UUID userUuid, PropertyUserPolicyAssignmentRequest request)`:
    - Look up user's role from `users`.
    - Insert/Upsert into `property_user_policies (property_uuid, user_uuid, user_role, tier_slug, status)`.
    - Return populated `PropertyUserPolicyResponse`.
  - `removeUserPolicy(UUID propertyId, UUID userUuid)`: logical soft-delete `UPDATE property_user_policies SET status = 'INACTIVE'`.

- [x] **Step 2: Implement `PropertyPolicyController.java`**
  - Implement generated OpenAPI API interfaces for roles, tiers, and property user policies.

- [x] **Step 3: Write unit tests in `PropertyPolicyControllerTest.java`**
  - Test `GET /api/v1/roles` returns 200 with active roles.
  - Test `GET /api/v1/corporate-policy-tiers` returns 200 with tiers.
  - Test `GET /api/v1/properties/{propertyId}/user-policies` returns 200 with assignments.
  - Test `PUT /api/v1/properties/{propertyId}/user-policies/{userUuid}` returns 200 when assigning authorized tier.

- [x] **Step 4: Verify backend compilation & tests**
  - Run `./backend/mvnw test` to ensure 100% test pass.

---

### Task 4: Frontend Contracts, Service & Adapters

**Files:**
- Modify: `frontend/src/types/api.ts`
- Create: `frontend/src/app/services/policyService.ts`

- [x] **Step 1: Regenerate TypeScript API types**
  - Run `npm --prefix frontend run generate:api`.
  - Export newly generated types in `frontend/src/types/api.ts`:
    - `RoleResponse`
    - `CorporatePolicyTierResponse`
    - `PropertyUserPolicyResponse`
    - `PropertyUserPolicyAssignmentRequest`

- [x] **Step 2: Implement `frontend/src/app/services/policyService.ts`**
  - `getRoles()`: `apiClient.GET("/api/v1/roles")`.
  - `getCorporatePolicyTiers()`: `apiClient.GET("/api/v1/corporate-policy-tiers")`.
  - `getPropertyUserPolicies(propertyId)`: `apiClient.GET("/api/v1/properties/{propertyId}/user-policies")`.
  - `assignPropertyUserPolicy(propertyId, userUuid, request)`: `apiClient.PUT("/api/v1/properties/{propertyId}/user-policies/{userUuid}", { body: request })`.
  - `removePropertyUserPolicy(propertyId, userUuid)`: `apiClient.DELETE("/api/v1/properties/{propertyId}/user-policies/{userUuid}")`.

---

### Task 5: Frontend UI Enhancement (`PayerPolicyRules.tsx`)

**Files:**
- Modify: `frontend/src/components/PayerPolicyRules.tsx`

- [x] **Step 1: Replace mock company policy inputs with Property Security Matrix**
  - Load active roles and `corporate_policy_tiers` on mount.
  - Display current property's assigned operatives table:
    - User name & email
    - Global Base Role badge (e.g. `SENIOR_PROPERTY_MANAGER`, `PROPERTY_MANAGER`)
    - Assigned Policy Tier badge with limits (`Max Variable: $5,000`, `Auto Fixed: $10,000`)
    - Action to remove/edit assignment.

- [x] **Step 2: Implement "Assign Financial Authority" Drawer/Modal (Spec Wireframe B)**
  - Select operative from available users.
  - Display their read-only **Global Base Role**.
  - Dynamically filter `corporate_policy_tiers` to show only policies matching `tier.allowedRole === selectedUser.role`.
  - Disable or hide illegal tiers.
  - Save button invokes `assignPropertyUserPolicy`, reloads assignments, and displays success feedback.

- [x] **Step 3: Verify frontend build**
  - Run `npm --prefix frontend run build` to confirm clean compilation and zero TypeScript errors.

---

### Task 6: End-to-End Verification

- [x] **Step 1: Full test suite verification**
  - Run `./backend/mvnw test`
  - Run `npm --prefix frontend run build`
  - Confirm all checks pass cleanly with 0 warnings or errors.

