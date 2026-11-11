# Property GL Accounts, Owner Entity & Cost Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish property-scoped General Ledger accounts (`property_gl_accounts`), expand Property metadata with `owner_entity` and `sqft`, and enhance the Property-Vendor junction (`property_vendor_mapping`) with contract `cost_type` (`FIXED_MONTHLY` vs `VARIABLE`) and `default_gl_code` pointers.

**Architecture:** Database schema enforces compound primary key `(gl_code, property_uuid)` for building-specific charts of accounts, with a compound foreign key on `property_vendor_mapping(default_gl_code, property_uuid)` to guarantee relationship integrity. Endpoints query directly via `JdbcTemplate` in `PropertyService` (no JPA Repository), exposed via OpenAPI. Frontend regenerates typed contracts via `openapi-typescript` and updates UI creation modals, policy rules, and mapping directories.

**Tech Stack:** Java 21, Spring Boot 3, Spring JDBC (`JdbcTemplate`), PostgreSQL / Flyway, OpenAPI 3.0 Generator, React 19, TypeScript, `openapi-typescript`, `openapi-fetch`, Tailwind CSS.

**Spec:** User requirements for `properties` (`owner_entity`, `sqft`), `property_gl_accounts` (compound key `(gl_code, property_uuid)`, `property_gl_account_uuid`, `gl_account_name`), and `property_vendor_mapping` (`cost_type`, `default_gl_code`).

## Global Constraints

- Do not create JPA `@Entity` or `JpaRepository` for `property_gl_accounts`; follow the metadata pattern querying directly with `JdbcTemplate` in `PropertyService`.
- Soft delete support: `property_gl_accounts` must include `status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'` and `updated_at`. Queries must filter `WHERE status = 'ACTIVE'`.
- Foreign key `fk_mapping_property_gl_account` on `property_vendor_mapping` must bind both `(default_gl_code, property_uuid)` to `property_gl_accounts(gl_code, property_uuid)` with `ON DELETE RESTRICT`.
- Frontend code must regenerate types via `npm run generate:api` rather than hand-writing DTO types.
- Both `./backend/mvnw compile test-compile` and `npm --prefix frontend run build` must compile cleanly with 0 errors.

## Review Focus

1. **Compound Foreign Key Integrity:** Verify that assigning a `default_gl_code` to a property-vendor mapping prevents assigning a GL code that belongs to a different property.
2. **Nullable / Default Fallbacks:** Verify that `cost_type` defaults to `'VARIABLE'` when omitted and rejects invalid enum strings.
3. **Square Footage & Owner Entity Validation:** Verify that `CreatePropertyModal` captures both `ownerEntity` and `sqft` (as numeric integer) and properly formats them on display.
4. **Codegen Synchronization:** Verify that running `npm run generate:api` updates `api.generated.ts` with `PropertyGlAccountResponse` and new property fields without manual overrides.
5. **No Regression on Seed Data:** Verify that `R__seed_test_data.sql` seeds `property_gl_accounts` for sample properties and references them cleanly in `property_vendor_mapping`.

---

## Tasks

### Task 1: Database Migration & Test Data Seeding

**Files:**
- Modify: `backend/src/main/resources/db/migration/V1__initial_schema.sql`
- Modify: `backend/src/main/resources/db/migration/R__seed_test_data.sql`

- [x] **Step 1: Update `properties` and add `property_gl_accounts` in `V1__initial_schema.sql`**
  - In `properties`: add `owner_entity VARCHAR(255)` and `sqft INTEGER`.
  - Add `property_gl_accounts`:
    ```sql
    CREATE TABLE property_gl_accounts
    (
        property_gl_account_uuid UUID                     NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        gl_code                  VARCHAR(50)              NOT NULL,
        property_uuid            UUID                     NOT NULL REFERENCES properties (property_uuid) ON DELETE CASCADE,
        gl_account_name          VARCHAR(100)             NOT NULL,
        description              VARCHAR(500),
        status                   VARCHAR(50)              NOT NULL DEFAULT 'ACTIVE',
        created_at               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (gl_code, property_uuid),
        CONSTRAINT check_property_gl_account_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
    );
    ```
  - In `property_vendor_mapping`: add `cost_type VARCHAR(20) NOT NULL DEFAULT 'VARIABLE'` with check constraint `('FIXED_MONTHLY', 'VARIABLE')`, and `default_gl_code VARCHAR(50)` with compound foreign key:
    ```sql
    CONSTRAINT fk_mapping_property_gl_account FOREIGN KEY (default_gl_code, property_uuid)
        REFERENCES property_gl_accounts (gl_code, property_uuid) ON DELETE RESTRICT
    ```

- [x] **Step 2: Update `R__seed_test_data.sql`**
  - Add `DELETE FROM property_gl_accounts;` before deleting properties.
  - Seed initial `property_gl_accounts` for Grandview Office Tower and Retail Plaza (e.g., `5100` Janitorial & Cleaning, `5200` HVAC Maintenance, `5300` Utilities & Electric, `5400` Security Systems).
  - Update `properties` insert statements with sample `owner_entity` ('Apex Holdings LLC', 'Metropolitan Retail Trust') and `sqft` (720000, 185000).
  - Update `property_vendor_mapping` seed to populate `cost_type` ('FIXED_MONTHLY' or 'VARIABLE') and valid `default_gl_code` references.

---

### Task 2: OpenAPI Specification & Model Codegen

**Files:**
- Create: `backend/src/main/resources/openapi/components/schemas/PropertyGlAccountResponse.yaml`
- Create: `backend/src/main/resources/openapi/paths/property_gl_accounts.yaml`
- Modify: `backend/src/main/resources/openapi/components/schemas/PropertyResponse.yaml`
- Modify: `backend/src/main/resources/openapi/components/schemas/PropertyCreateRequest.yaml`
- Modify: `backend/src/main/resources/openapi/openapi.yaml`

- [x] **Step 1: Create `PropertyGlAccountResponse.yaml`**
  Define fields:
  ```yaml
  type: object
  required:
    - propertyGlAccountUuid
    - glCode
    - propertyUuid
    - glAccountName
    - status
  properties:
    propertyGlAccountUuid:
      type: string
      format: uuid
    glCode:
      type: string
      example: "5120"
    propertyUuid:
      type: string
      format: uuid
    glAccountName:
      type: string
      example: "Grounds Maintenance"
    description:
      type: string
      example: "Exterior landscaping and snow removal"
    status:
      type: string
      example: "ACTIVE"
  ```

- [x] **Step 2: Update `PropertyResponse.yaml` & `PropertyCreateRequest.yaml`**
  Add `ownerEntity` (type: string, optional in create, example: "Apex Holdings LLC") and `sqft` (type: integer, example: 250000).

- [x] **Step 3: Create `property_gl_accounts.yaml` path**
  Map `GET /api/v1/properties/{propertyId}/gl-accounts`:
  - Tag: `Properties`
  - OperationId: `getPropertyGlAccounts`
  - Parameter: `propertyId` (path, UUID)
  - Response 200: array of `PropertyGlAccountResponse`.

- [x] **Step 4: Register path and schema in `openapi.yaml`**
  Add `/api/v1/properties/{propertyId}/gl-accounts` and `PropertyGlAccountResponse` component.

---

### Task 3: Backend Entities, Service & Controller Implementation

**Files:**
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/entity/PropertyEntity.java`
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/entity/PropertyVendorMappingEntity.java`
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/service/PropertyService.java`
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/controller/PropertyController.java`

- [x] **Step 1: Update `PropertyEntity.java`**
  - Add fields `ownerEntity` (`@Column(name = "owner_entity")`) and `sqft` (`@Column(name = "sqft")`).
  - Update `toResponse()` to populate `ownerEntity` and `sqft`.

- [x] **Step 2: Update `PropertyVendorMappingEntity.java`**
  - Add `costType` (`@Column(name = "cost_type", nullable = false)`) and `defaultGlCode` (`@Column(name = "default_gl_code")`).

- [x] **Step 3: Update `PropertyService.java`**
  - Implement `getAllPropertyGlAccounts(UUID propertyId)` using `JdbcTemplate`:
    ```java
    @Transactional(readOnly = true)
    public List<PropertyGlAccountResponse> getAllPropertyGlAccounts(UUID propertyId) {
        String sql = "SELECT property_gl_account_uuid, gl_code, property_uuid, gl_account_name, description, status " +
                     "FROM property_gl_accounts WHERE property_uuid = ? AND status = 'ACTIVE' ORDER BY gl_code ASC";
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            PropertyGlAccountResponse res = new PropertyGlAccountResponse();
            res.setPropertyGlAccountUuid((UUID) rs.getObject("property_gl_account_uuid"));
            res.setGlCode(rs.getString("gl_code"));
            res.setPropertyUuid((UUID) rs.getObject("property_uuid"));
            res.setGlAccountName(rs.getString("gl_account_name"));
            res.setDescription(rs.getString("description"));
            res.setStatus(rs.getString("status"));
            return res;
        }, propertyId);
    }
    ```
  - Update `createProperty(PropertyCreateRequest request)` to set `ownerEntity` and `sqft` on the `PropertyEntity`.

- [x] **Step 4: Update `PropertyController.java`**
  - Implement `@Override public ResponseEntity<List<PropertyGlAccountResponse>> getPropertyGlAccounts(UUID propertyId)` delegating to `propertyService.getAllPropertyGlAccounts(propertyId)`.

- [x] **Step 5: Verify backend compilation**
  Run `./backend/mvnw -f backend/pom.xml compile test-compile` to verify 0 errors.

---

### Task 4: Frontend Type Generation & Service Adaptation

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/app/adapters/propertyAdapter.ts`
- Modify: `frontend/src/app/services/propertyService.ts`

- [x] **Step 1: Regenerate TypeScript contracts**
  Run `npm --prefix frontend run generate:api` to re-create `frontend/src/types/api.generated.ts`.

- [x] **Step 2: Update `frontend/src/types/api.ts`**
  Export `PropertyGlAccountResponse = Schema<'PropertyGlAccountResponse'>;`.

- [x] **Step 3: Update `frontend/src/types.ts`**
  - Add `ownerEntity?: string;` to `Property`.
  - Add `costType?: 'FIXED_MONTHLY' | 'VARIABLE';` and `defaultGlCode?: string;` to `PropertyVendorRelationship`.

- [x] **Step 4: Update `propertyAdapter.ts`**
  - Add `ownerEntity?: string;` and `sqft?: number;` to `CreatePropertyInput`.
  - In `toUIProperty(dto, existingUIProp)`: map `ownerEntity: dto.ownerEntity || existingUIProp?.ownerEntity` and `sqft: dto.sqft ?? existingUIProp?.sqft ?? 250000`.
  - In `toBackendPropertyCreate(ui)`: pass `ownerEntity` and `sqft`.

- [x] **Step 5: Update `propertyService.ts`**
  - Add `getPropertyGlAccounts(propertyId: string)` using `apiClient.GET('/api/v1/properties/{propertyId}/gl-accounts', { params: { path: { propertyId } } })`.

---

### Task 5: Frontend UI Enhancements

**Files:**
- Modify: `frontend/src/components/CreatePropertyModal.tsx`
- Modify: `frontend/src/components/PayerPolicyRules.tsx`
- Modify: `frontend/src/components/PropertyVendorMatching.tsx`

- [x] **Step 1: Update `CreatePropertyModal.tsx`**
  - Add state for `ownerEntity` (default `''`) and `sqft` (default `''` or `'250000'`).
  - Add form input for **Owner Entity / Holding Company** (placeholder: "e.g. Apex Holdings LLC").
  - Add form input for **Gross Building Area (sq ft)** (numeric input with integer validation).
  - Include both in the submission payload.

- [x] **Step 2: Update `PayerPolicyRules.tsx`**
  - In the property card/selector, display `prop.ownerEntity` alongside the building name and format `prop.sqft.toLocaleString() + ' sq ft'`.

- [x] **Step 3: Update `PropertyVendorMatching.tsx`**
  - Display `costType` badge: `Fixed Monthly` (emerald) vs `Variable` (amber/slate).
  - Display assigned `defaultGlCode` badge if present (or 'Unassigned').

- [x] **Step 4: Verify frontend build**
  Run `npm --prefix frontend run build` to confirm clean compilation and zero TypeScript errors.

