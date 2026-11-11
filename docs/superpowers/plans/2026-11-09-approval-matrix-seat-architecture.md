# Accounts Payable Approval Matrix & Seat Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the invoice approval authorization model from direct user-to-property policy assignments to an abstract Role-Based Access Control (RBAC) Seat and Property Sequence Matrix architecture with a runtime routing queue engine.

**Architecture:** 
- **Decoupled RBAC Hierarchy**: Humans (`users`) are pure identities with zero intrinsic approval authority; operational positions (`accounts_payable_seats`) hold authority and are assigned to spending limits (`accounts_payable_threshold_presets`) per real estate asset in a single-file sequential ladder (`property_approval_matrix`, sequence 0–5).
- **Fiduciary Safety Net & Dynamic Routing**: Sequence Step 5 is permanently locked to unlimited VP clearance (`LIMIT_UNLIMITED`), ensuring no invoice enters an orphaned dead zone. A runtime Java engine (`calculateInvoiceRoutingQueue`) slices the escalation chain from baseline review up to the required clearance tier and handles delegation proxies with cycle prevention.
- **Spring Boot & OpenAPI**: Metadata and matrix operations query via `JdbcTemplate` without redundant JPA entity overhead; OpenAPI 3.0 contracts remain strictly modular (<120 line root).
- **React Frontend**: `PayerPolicyRules.tsx` provides an interactive 0–5 sequence ladder and an operational seat directory.

**Tech Stack:** Java 21, Spring Boot 3.x, PostgreSQL 16, Flyway, OpenAPI 3.0, openapi-generator, TypeScript 5, React 19, Vite, Tailwind CSS.

**Spec:** [`docs/superpowers/plans/Invoice-Approval -Spec-Refactoring.md`](file:///Users/spira/Documents/Projects/invoice-automation-service/docs/superpowers/plans/Invoice-Approval%20-Spec-Refactoring.md)

---

## Global Constraints

- **Single-File Linear Sequence**: `accounts_payable_approval_sequence` must be an integer between 0 and 5 per property. Step 5 is permanently locked to `LIMIT_UNLIMITED`.
- **Soft Deletion Compliance**: No hard SQL deletions (`DELETE`) on matrix configurations or seat assignments; lifecycles are governed via `status VARCHAR(10) CHECK (status IN ('ACTIVE', 'INACTIVE'))`.
- **Single Active Occupant**: A seat can only have one active human occupant at any given time, enforced via partial unique index `unique_active_seat_occupant`.
- **Pure Identity Users**: `users` table holds no role column. User fields are `user_uuid`, `user_name`, `email`, `status`, `delegate_user_uuid`, `delegate_expires_at`.
- **OpenAPI Hygiene**: Modular layout under `backend/src/main/resources/openapi/`; `openapi.yaml` must not exceed 120 lines.

---

## Review Focus

1. **Routing Escalation Slice**: An invoice for $15,000 must include sequence steps from step 0 up to the first step whose threshold covers $15,000; it must not skip junior intake review or return steps higher than the first covering approver.
2. **Safety Net Immutability**: Any attempt to DELETE Sequence Step 5 or UPDATE it to a preset other than `LIMIT_UNLIMITED` must be rejected with HTTP 400 Bad Request.
3. **Delegation Cycle Prevention**: If User A delegates to User B and User B delegates to User A, the routing calculation engine must not enter an infinite loop and must terminate cleanly.
4. **Vacant Seat Warning**: If an approval step in the calculated routing queue has no active human occupant, the queue output must return the step flagged as vacant (`userUuid: null`, `requiresSeatAssignment: true`) rather than silently dropping the step.
5. **Cost Type Sensitivity**: If `costType == FIXED_MONTHLY`, the engine must evaluate against `fixed_auto_max`; if `VARIABLE`, it must evaluate against `variable_max`.

---

## Plan Overview & Decomposition

```
Task 1: Database Migration Refactor (V1, V4, R seeds)
Task 2: User Domain & Main Branch Compatibility Refactor
Task 3: OpenAPI 3.0 Contract Specification
Task 4: Backend Service, Routing Queue Engine & Unit Tests
Task 5: Frontend API Client, Types & Test Fixtures
Task 6: Frontend UI Enhancement (PayerPolicyRules.tsx)
Task 7: End-to-End Test Suite Verification
```

---

### Task 1: Database Migration Refactor (`V1`, `V4`, `R` Seeds)

**Files:**
- Modify: `backend/src/main/resources/db/migration/V1__initial_schema.sql`
- Modify: `backend/src/main/resources/db/migration/V4__seed_system_user.sql`
- Modify: `backend/src/main/resources/db/migration/R__seed_test_data.sql`

**Interfaces:**
- Produces:
  - Tables: `corporate_designations`, `accounts_payable_seats`, `accounts_payable_threshold_presets`, `accounts_payable_seat_assignment`, `property_approval_matrix`.
  - Updated table: `users` (without `role`/`global_role`, with `delegate_user_uuid`, `delegate_expires_at`).
  - Removed tables: `roles`, `corporate_policy_tiers`, `property_user_policies`.

- [ ] **Step 1: Update `V1__initial_schema.sql`**
  - Drop the prior `roles`, `corporate_policy_tiers`, and `property_user_policies` tables.
  - Define `corporate_designations`:
    ```sql
    CREATE TABLE corporate_designations
    (
        designation_slug VARCHAR(50) PRIMARY KEY,
        display_name     VARCHAR(100) NOT NULL,
        status           VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE',
        created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT check_designation_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
    );
    ```
  - Define `accounts_payable_seats` (pure RBAC positions, no designation FK):
    ```sql
    CREATE TABLE accounts_payable_seats
    (
        accounts_payable_seat_slug VARCHAR(50) PRIMARY KEY,
        display_name               VARCHAR(100) NOT NULL,
        status                     VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE',
        created_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT check_ap_seat_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
    );
    ```
  - Define `accounts_payable_threshold_presets`:
    ```sql
    CREATE TABLE accounts_payable_threshold_presets
    (
        accounts_payable_threshold_slug VARCHAR(50) PRIMARY KEY,
        variable_max                    NUMERIC(12, 2) NOT NULL CHECK (variable_max >= 0.00),
        fixed_auto_max                  NUMERIC(12, 2) NOT NULL CHECK (fixed_auto_max >= 0.00),
        status                          VARCHAR(10)    NOT NULL DEFAULT 'ACTIVE',
        created_at                      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at                      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT check_ap_preset_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
    );
    ```
  - Update `users` table:
    - Remove `role` / `global_role`.
    - Add `delegate_user_uuid UUID REFERENCES users(user_uuid) ON DELETE SET NULL`.
    - Add `delegate_expires_at TIMESTAMP WITH TIME ZONE`.
    - Add `CONSTRAINT check_no_self_delegation CHECK (delegate_user_uuid != user_uuid)`.
  - Define `accounts_payable_seat_assignment`:
    ```sql
    CREATE TABLE accounts_payable_seat_assignment
    (
        assignment_uuid            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        accounts_payable_seat_slug VARCHAR(50) NOT NULL REFERENCES accounts_payable_seats(accounts_payable_seat_slug) ON DELETE CASCADE,
        user_uuid                  UUID NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
        status                     VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
        created_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT check_seat_assign_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
        CONSTRAINT unique_user_seat_pairing UNIQUE (accounts_payable_seat_slug, user_uuid)
    );

    CREATE UNIQUE INDEX unique_active_seat_occupant
    ON accounts_payable_seat_assignment (accounts_payable_seat_slug)
    WHERE (status = 'ACTIVE');
    ```
  - Define `property_approval_matrix`:
    ```sql
    CREATE TABLE property_approval_matrix
    (
        matrix_uuid                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_uuid                      UUID NOT NULL REFERENCES properties(property_uuid) ON DELETE CASCADE,
        accounts_payable_seat_slug         VARCHAR(50) NOT NULL REFERENCES accounts_payable_seats(accounts_payable_seat_slug),
        accounts_payable_threshold_slug    VARCHAR(50) NOT NULL REFERENCES accounts_payable_threshold_presets(accounts_payable_threshold_slug),
        accounts_payable_approval_sequence INT NOT NULL CHECK (accounts_payable_approval_sequence BETWEEN 0 AND 5),
        status                             VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
        created_at                         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at                         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT check_matrix_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
        CONSTRAINT unique_property_seat_step UNIQUE (property_uuid, accounts_payable_seat_slug),
        CONSTRAINT unique_property_sequence_step UNIQUE (property_uuid, accounts_payable_approval_sequence)
    );
    ```

- [ ] **Step 2: Update `V4__seed_system_user.sql`**
  - Update `INSERT INTO users (user_uuid, user_name, email, status)` to exclude `role`.

- [ ] **Step 3: Update `R__seed_test_data.sql`**
  - Clean child tables in order: `property_approval_matrix`, `accounts_payable_seat_assignment`, `accounts_payable_seats`, `accounts_payable_threshold_presets`, `corporate_designations`.
  - Seed `corporate_designations` (`ACCOUNTANT`, `PROPERTY_MANAGER`, `SENIOR_PROPERTY_MANAGER`, `REGIONAL_DIRECTOR`, `VICE_PRESIDENT`).
  - Seed `accounts_payable_seats` (`CORP_HQ_ACCOUNTANT_01`, `PM_SEAT_FRISCO_OFFICE`, `SPM_SEAT_DOWNTOWN`, `REG_DIR_TEXAS_REGION`, `CORP_VP_OF_OPERATIONS`).
  - Seed `accounts_payable_threshold_presets` (`LIMIT_NONE`, `LIMIT_LOW`, `LIMIT_MID`, `LIMIT_HIGH`, `LIMIT_UNLIMITED`).
  - Seed `users` with `(user_name, email, status)`.
  - Seed `accounts_payable_seat_assignment` mapping Sarah Jenkins, Marcus Vance, Elena Rostova, David Sterling, and Victoria Chen to seats.
  - Seed `property_approval_matrix` for *Grandview Office Tower*:
    - Sequence 0: `CORP_HQ_ACCOUNTANT_01` -> `LIMIT_NONE`
    - Sequence 1: `PM_SEAT_FRISCO_OFFICE` -> `LIMIT_LOW`
    - Sequence 2: `SPM_SEAT_DOWNTOWN` -> `LIMIT_MID`
    - Sequence 5: `CORP_VP_OF_OPERATIONS` -> `LIMIT_UNLIMITED` (Safety net).

- [ ] **Step 4: Verify migration syntax**
  - Verify SQL file syntax and constraint names.

---

### Task 2: User Domain & Main Branch Compatibility Refactor

**Files:**
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/entity/UserEntity.java`
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/service/UserService.java`
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/repository/UserRepository.java`

**Interfaces:**
- Consumes: Database schema from Task 1
- Produces: Updated `UserEntity` without `role`, with `delegateUserUuid` and `delegateExpiresAt`.

- [ ] **Step 1: Update `UserEntity.java`**
  - Remove `@Column(name = "global_role") private String role;`
  - Add `@Column(name = "delegate_user_uuid") private UUID delegateUserUuid;`
  - Add `@Column(name = "delegate_expires_at") private OffsetDateTime delegateExpiresAt;`

- [ ] **Step 2: Update `UserService.java`**
  - Remove all `entity.setRole(...)` and `response.setRole(...)` references.
  - Support `delegateUserUuid` and `delegateExpiresAt` in `createUser`, `updateUserByUserId`, and `toResponse`.

- [ ] **Step 3: Clean `UserRepository.java`**
  - Remove unused queries referencing `u.role`.

---

### Task 3: OpenAPI 3.0 Contract Specification

**Files:**
- Delete: `backend/src/main/resources/openapi/paths/roles.yaml`
- Delete: `backend/src/main/resources/openapi/paths/corporate_policy_tiers.yaml`
- Delete: `backend/src/main/resources/openapi/paths/property_user_policies.yaml`
- Delete: `backend/src/main/resources/openapi/paths/property_user_policies_by_id.yaml`
- Delete: `backend/src/main/resources/openapi/components/schemas/RoleResponse.yaml`
- Delete: `backend/src/main/resources/openapi/components/schemas/CorporatePolicyTierResponse.yaml`
- Delete: `backend/src/main/resources/openapi/components/schemas/PropertyUserPolicyResponse.yaml`
- Delete: `backend/src/main/resources/openapi/components/schemas/PropertyUserPolicyAssignmentRequest.yaml`
- Modify: `backend/src/main/resources/openapi/components/schemas/UserResponse.yaml`
- Modify: `backend/src/main/resources/openapi/components/schemas/UserCreateRequest.yaml`
- Modify: `backend/src/main/resources/openapi/components/schemas/UserUpdateRequest.yaml`
- Create: `backend/src/main/resources/openapi/components/schemas/CorporateDesignationResponse.yaml`
- Create: `backend/src/main/resources/openapi/components/schemas/AccountsPayableSeatResponse.yaml`
- Create: `backend/src/main/resources/openapi/components/schemas/AccountsPayableThresholdPresetResponse.yaml`
- Create: `backend/src/main/resources/openapi/components/schemas/SeatAssignmentRequest.yaml`
- Create: `backend/src/main/resources/openapi/components/schemas/SeatAssignmentResponse.yaml`
- Create: `backend/src/main/resources/openapi/components/schemas/PropertyApprovalMatrixResponse.yaml`
- Create: `backend/src/main/resources/openapi/components/schemas/PropertyApprovalMatrixStepRequest.yaml`
- Create: `backend/src/main/resources/openapi/components/schemas/ApprovalQueueStepResponse.yaml`
- Create: `backend/src/main/resources/openapi/components/schemas/ApprovalQueueResponse.yaml`
- Create: `backend/src/main/resources/openapi/paths/corporate_designations.yaml`
- Create: `backend/src/main/resources/openapi/paths/accounts_payable_seats.yaml`
- Create: `backend/src/main/resources/openapi/paths/accounts_payable_threshold_presets.yaml`
- Create: `backend/src/main/resources/openapi/paths/seat_assignments.yaml`
- Create: `backend/src/main/resources/openapi/paths/property_approval_matrix.yaml`
- Create: `backend/src/main/resources/openapi/paths/property_approval_matrix_by_step.yaml`
- Create: `backend/src/main/resources/openapi/paths/property_approval_queue.yaml`
- Modify: `backend/src/main/resources/openapi/openapi.yaml`

**Interfaces:**
- Produces: Generated Spring interfaces (`CorporateDesignationsApi`, `AccountsPayableSeatsApi`, `AccountsPayableThresholdPresetsApi`, `PropertiesApi`)

- [ ] **Step 1: Update User OpenAPI fragments**
  - In `UserResponse.yaml`, `UserCreateRequest.yaml`, `UserUpdateRequest.yaml`: remove `role`, add `delegateUserUuid` (`uuid`) and `delegateExpiresAt` (`date-time`).

- [ ] **Step 2: Create new Schema fragments**
  - `CorporateDesignationResponse.yaml`: `designationSlug`, `displayName`, `status`.
  - `AccountsPayableSeatResponse.yaml`: `accountsPayableSeatSlug`, `displayName`, `status`, `assignedUserUuid`, `assignedUserName`, `assignedUserEmail`.
  - `AccountsPayableThresholdPresetResponse.yaml`: `accountsPayableThresholdSlug`, `variableMax`, `fixedAutoMax`, `status`.
  - `SeatAssignmentRequest.yaml`: `userUuid`.
  - `SeatAssignmentResponse.yaml`: `assignmentUuid`, `accountsPayableSeatSlug`, `userUuid`, `userName`, `userEmail`, `status`.
  - `PropertyApprovalMatrixResponse.yaml`: `matrixUuid`, `propertyUuid`, `accountsPayableSeatSlug`, `seatDisplayName`, `accountsPayableThresholdSlug`, `variableMax`, `fixedAutoMax`, `accountsPayableApprovalSequence`, `assignedUserUuid`, `assignedUserName`, `assignedUserEmail`, `status`.
  - `PropertyApprovalMatrixStepRequest.yaml`: `accountsPayableSeatSlug`, `accountsPayableThresholdSlug`, `accountsPayableApprovalSequence`.
  - `ApprovalQueueStepResponse.yaml`: `sequence`, `seatSlug`, `seatDisplayName`, `userUuid`, `userName`, `userEmail`, `isProxy`, `isVacant`, `thresholdSlug`, `variableMax`, `fixedAutoMax`.
  - `ApprovalQueueResponse.yaml`: `propertyUuid`, `grossAmount`, `costType`, `hasVacantStep`, `steps` (array of `ApprovalQueueStepResponse`).

- [ ] **Step 3: Create new Path fragments**
  - `GET /api/v1/corporate-designations`
  - `GET /api/v1/accounts-payable-seats`
  - `GET /api/v1/accounts-payable-threshold-presets`
  - `PUT /api/v1/accounts-payable-seats/{seatSlug}/assignment` (body `SeatAssignmentRequest`)
  - `DELETE /api/v1/accounts-payable-seats/{seatSlug}/assignment`
  - `GET /api/v1/properties/{propertyId}/approval-matrix`
  - `POST /api/v1/properties/{propertyId}/approval-matrix` (body `PropertyApprovalMatrixStepRequest`)
  - `PUT /api/v1/properties/{propertyId}/approval-matrix/{sequence}`
  - `DELETE /api/v1/properties/{propertyId}/approval-matrix/{sequence}`
  - `GET /api/v1/properties/{propertyId}/approval-queue` (query params: `grossAmount`, `costType`)

- [ ] **Step 4: Register fragments in `openapi.yaml` and verify structure**
  - Delete replaced references, add new references.
  - Run `OpenApiSpecStructureTest` to verify all `$ref`s resolve and root stays <120 lines.

---

### Task 4: Backend Service, Routing Queue Engine & Unit Tests

**Files:**
- Delete: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/service/PropertyPolicyService.java`
- Delete: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/controller/CorporatePolicyController.java`
- Delete: `backend/src/test/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/controller/PropertyPolicyControllerTest.java`
- Create: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/service/PropertyApprovalMatrixService.java`
- Create: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/controller/AccountsPayableMetadataController.java`
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/controller/PropertyController.java`
- Create: `backend/src/test/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/service/PropertyApprovalMatrixServiceTest.java`
- Create: `backend/src/test/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/controller/PropertyApprovalMatrixControllerTest.java`

**Interfaces:**
- Consumes: Generated OpenAPI interfaces and database tables
- Produces:
  - `getAllDesignations()`, `getAllSeats()`, `getAllPresets()`
  - `assignSeatOccupant(seatSlug, request)`, `vacateSeat(seatSlug)`
  - `getPropertyApprovalMatrix(propertyId)`, `addMatrixStep(propertyId, request)`, `updateMatrixStep(propertyId, sequence, request)`, `deleteMatrixStep(propertyId, sequence)`
  - `calculateInvoiceRoutingQueue(propertyId, grossAmount, costType)`

- [ ] **Step 1: Implement `PropertyApprovalMatrixService.java`**
  - `getAllDesignations()`, `getAllSeats()`, `getAllPresets()`.
  - `assignSeatOccupant`: upserts into `accounts_payable_seat_assignment`, deactivating previous occupant if any.
  - `vacateSeat`: sets active occupant `status = 'INACTIVE'`.
  - `getPropertyApprovalMatrix`: queries `property_approval_matrix` joined with seats, presets, active occupants, and users, ordered by `accounts_payable_approval_sequence ASC`.
  - `addMatrixStep` / `updateMatrixStep`: validates sequence bounds (0–5); enforces that sequence 5 must be `LIMIT_UNLIMITED`.
  - `deleteMatrixStep`: prevents deleting sequence step 5 (fiduciary safety net guardrail).
  - `calculateInvoiceRoutingQueue`:
    - Retrieves active matrix steps ordered by sequence ASC.
    - Slices from step 0 up to the first step whose limit covers `grossAmount` (`fixed_auto_max` if `FIXED_MONTHLY`, `variable_max` otherwise).
    - Checks delegation: if occupant has active `delegate_user_uuid` with unexpired date, resolves delegate with visited set protection (no infinite loops).
    - If a required step has no occupant, marks `isVacant: true` and `hasVacantStep: true`.

- [ ] **Step 2: Implement Controllers**
  - `AccountsPayableMetadataController.java`: implements `CorporateDesignationsApi`, `AccountsPayableSeatsApi`, `AccountsPayableThresholdPresetsApi`.
  - `PropertyController.java`: implements matrix CRUD and approval queue endpoints.

- [ ] **Step 3: Write comprehensive unit tests in `PropertyApprovalMatrixServiceTest.java`**
  - Test routing queue escalation: $500 invoice routes step 0 and step 1 (does not escalate to VP).
  - Test routing queue escalation: $15,000 invoice routes steps 0, 1, 2, and 5.
  - Test safety net guardrail: deleting step 5 throws `BadRequestException`.
  - Test safety net guardrail: updating step 5 to `LIMIT_LOW` throws `BadRequestException`.
  - Test delegation: active delegate replaces user as proxy.
  - Test delegation cycle: cyclic delegation halts without infinite loop.
  - Test vacant seat: vacant required step returns `isVacant: true`.

- [ ] **Step 4: Write controller tests in `PropertyApprovalMatrixControllerTest.java`**
  - Test HTTP 200/201/204 responses and error status codes.

- [ ] **Step 5: Verify backend tests pass**
  - Run `./backend/mvnw test` to ensure 100% test pass.

---

### Task 5: Frontend API Client, Types & Test Fixtures

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/types/user.ts`
- Delete: `frontend/src/app/services/policyService.ts`
- Create: `frontend/src/app/services/approvalMatrixService.ts`
- Modify: `frontend/tests/app/services/userService.test.ts`
- Modify: `frontend/src/components/UserList.tsx`
- Modify: `frontend/src/data/mockData.ts`

**Interfaces:**
- Consumes: OpenAPI spec
- Produces: Regenerated `frontend/src/types/api.generated.ts`, `approvalMatrixService.ts` client.

- [ ] **Step 1: Regenerate TypeScript API types**
  - Run `npm --prefix frontend run generate:api`.
  - Re-export new contract types in `frontend/src/types/api.ts`.

- [ ] **Step 2: Update `types/user.ts`, `UserList.tsx`, and `userService.test.ts`**
  - Remove `role` from `User`, `UserResponse`, `UserCreateRequest`, `UserUpdateRequest`.
  - Update `UserList.tsx` to render `{user.status}` instead of `{user.role}`.
  - Update `userService.test.ts` to assert against clean user fixtures without `role`.
  - Run `npm --prefix frontend test` to confirm green test suite.

- [ ] **Step 3: Create `approvalMatrixService.ts`**
  - `getCorporateDesignations()`
  - `getAccountsPayableSeats()`
  - `getAccountsPayableThresholdPresets()`
  - `assignSeatOccupant(seatSlug, userUuid)`
  - `vacateSeat(seatSlug)`
  - `getPropertyApprovalMatrix(propertyId)`
  - `createMatrixStep(propertyId, request)`
  - `updateMatrixStep(propertyId, sequence, request)`
  - `deleteMatrixStep(propertyId, sequence)`
  - `getApprovalQueue(propertyId, grossAmount, costType)`

- [ ] **Step 4: Update `mockData.ts`**
  - Update mock data with designations, seats, presets, and sample matrix rows for offline fallback.

---

### Task 6: Frontend UI Enhancement (`PayerPolicyRules.tsx`)

**Files:**
- Modify: `frontend/src/components/PayerPolicyRules.tsx`

- [ ] **Step 1: Build the Single-File Property Approval Matrix Table (Steps 0–5)**
  - Select active property context.
  - Display the 0–5 sequential step ladder:
    - Step 0: Accountant Intake Floor
    - Steps 1–4: Junior & Intermediate Review Steps
    - Step 5: Locked VP Fallback Safety Net (with lock icon and badge: `Permanent Fiduciary Safety Net`)
  - Columns: Sequence Rank, Operational Seat, Current Occupant (with delegate proxy pill if active), Monetary Thresholds (`variable_max`, `fixed_auto_max`), Actions (Edit / Remove for steps 1–4).
  - Add "Add Sequence Step" button opening a modal to insert or replace an unoccupied step.

- [ ] **Step 2: Build the Operational Seats & Occupant Directory Panel**
  - Directory grid showing all seats (`CORP_HQ_ACCOUNTANT_01`, `PM_SEAT_FRISCO_OFFICE`, etc.).
  - Shows current active occupant, contact email, and active proxy delegate.
  - "Assign Occupant" button opening a modal to select a human from `getUsers()`.
  - "Vacate Seat" action to clear an occupant during employee turnover.

- [ ] **Step 3: Add Live Invoice Routing Preview Tool**
  - In the matrix panel, provide a quick "Test Routing Queue" input:
    - Enter a test invoice amount (e.g., `$15,000`).
    - Choose cost type (`VARIABLE` or `FIXED_MONTHLY`).
    - Live display calls `getApprovalQueue` and renders the exact visual step chain of approvers who will receive the bill.

- [ ] **Step 4: Verify frontend build**
  - Run `npm --prefix frontend run build` to confirm clean compilation and zero TypeScript errors.

---

### Task 7: End-to-End Test Suite Verification

- [ ] **Step 1: Full backend suite verification**
  - Run `./backend/mvnw test`
  - Confirm 100% test pass with zero failures or errors.

- [ ] **Step 2: Full frontend suite verification**
  - Run `npm --prefix frontend test`
  - Run `npm --prefix frontend run build`
  - Confirm all tests and bundle builds pass cleanly.

