# Property Object Integration Implementation Plan (JSONB Address, PropertyType & Frontend Creation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bridge the Property domain gap between frontend and backend by introducing a typed `PropertyType` enum, restructuring Property address into a nested `Address` schema (persisted as JSONB in PostgreSQL without hardcoded UUIDs), and delivering a "Create Property" modal with discrete address inputs in the frontend.

**Architecture:**
- **Backend Contract**: OpenAPI defines `PropertyType.yaml` enum (`COMMERCIAL_OFFICE`, `RETAIL_PLAZA`, `INDUSTRIAL_PARK`, `MEDICAL_CENTER`) and `Address.yaml` schema (`streetAddress`, `city`, `state`, `zipCode`) referenced by `PropertyResponse.yaml` and `PropertyCreateRequest.yaml`.
- **Database & Persistence**: `V1__initial_schema.sql` directly defines `properties` with `address JSONB NOT NULL` and `property_type VARCHAR(50) NOT NULL`. `V2__seed_properties.sql` is deleted. Repeatable migration `R__seed_test_data.sql` cleanly clears and reseeds meaningful properties, vendors, mappings, and invoices letting PostgreSQL's `gen_random_uuid()` generate all primary keys without hardcoded UUIDs. Hibernate maps `Address` using `@JdbcTypeCode(SqlTypes.JSON)`.
- **Frontend Contract & Adapters**: Updated TypeScript types in `frontend/src/types/property.ts` to include `AddressDTO` and `PropertyTypeDTO`, updating `propertyAdapter.ts` to cleanly bidirectional-map between rich UI properties and backend JSONB address payloads without brittle string parsing.
- **Frontend UI & State**: Discrete address inputs (`streetAddress`, `city`, `state`, `zipCode`) inside an accessible `CreatePropertyModal.tsx` wired directly into `useMasterData.ts` and `InvoiceContext.tsx` via `createProperty` API.

**Tech Stack:** Spring Boot 4 / Java 21, Flyway, PostgreSQL (JSONB), OpenAPI Generator, React 19, TypeScript, Tailwind CSS, Lucide icons.

**Spec:** Choice A + First-class `PropertyType` enum + Database-generated UUIDs in seeds.

---

## Global Constraints
- **Zero TypeScript Errors**: `npm --prefix frontend run build` must succeed cleanly.
- **Policy Handling**: Payer Policy remains in frontend mock/client state for this task; no backend policy persistence is introduced.
- **No Hardcoded UUIDs in Seed Data**: `R__seed_test_data.sql` must rely on `DEFAULT gen_random_uuid()` and resolve relational foreign keys dynamically via subqueries.
- **Clean V1 Schema & Seeds**: Since we are in active development, update `V1__initial_schema.sql` directly to use `address JSONB` and `property_type`, delete `V2__seed_properties.sql`, and maintain seed data in repeatable migration `R__seed_test_data.sql`.
- **TDD / Verification**: All changes must be verified through builds and unit tests (frontend build/typecheck + adapter tests).

---

## Review Focus
1. **Address Roundtripping**: Formatting an address from discrete fields to UI string and decomposing back into backend JSONB payload must not drop suite numbers or special characters.
2. **Duplicate Property Detection**: Property deduplication in `PropertyRepository` must check street address and zip code within the JSONB column.
3. **PropertyType Mapping**: Mapping between frontend snake_case (`commercial_office`) and backend UPPERCASE (`COMMERCIAL_OFFICE`) must be handled transparently in `propertyAdapter.ts`.
4. **Optimistic UI Updates vs. Backend Failure**: If backend property creation fails (e.g. duplicate or network down), UI must catch and handle gracefully without corrupting local state.
5. **Dynamic Seed Integrity**: Reseeding in `R__seed_test_data.sql` must succeed repeatedly without primary or foreign key collisions.

---

### Task 1: Backend OpenAPI Spec & Schema Migration (`Address` & `PropertyType`)

**Files:**
- Create: `backend/src/main/resources/openapi/components/schemas/Address.yaml`
- Create: `backend/src/main/resources/openapi/components/schemas/PropertyType.yaml`
- Modify: `backend/src/main/resources/openapi/components/schemas/PropertyCreateRequest.yaml`
- Modify: `backend/src/main/resources/openapi/components/schemas/PropertyResponse.yaml`
- Modify: `backend/src/main/resources/openapi/openapi.yaml`
- Modify: `backend/src/main/resources/db/migration/V1__initial_schema.sql`
- Delete: `backend/src/main/resources/db/migration/V2__seed_properties.sql`
- Modify: `backend/src/main/resources/db/migration/R__seed_test_data.sql`

**Interfaces:**
- Produces:
  - OpenAPI schema `Address` (`streetAddress`, `city`, `state`, `zipCode`).
  - OpenAPI schema `PropertyType` (`COMMERCIAL_OFFICE`, `RETAIL_PLAZA`, `INDUSTRIAL_PARK`, `MEDICAL_CENTER`).
  - `PropertyCreateRequest`: `{ name: string, propertyType: PropertyType, address: Address }`
  - `PropertyResponse`: `{ propertyId: UUID, name: string, propertyType: PropertyType, address: Address, status: string }`

- [ ] **Step 1: Create Address.yaml OpenAPI schema**
Create `backend/src/main/resources/openapi/components/schemas/Address.yaml`:
```yaml
type: object
required:
  - streetAddress
  - city
  - state
  - zipCode
properties:
  streetAddress:
    type: string
    example: "125 Industrial Way"
  city:
    type: string
    example: "Springfield"
  state:
    type: string
    example: "IL"
  zipCode:
    type: string
    example: "62701"
```

- [ ] **Step 2: Create PropertyType.yaml OpenAPI schema**
Create `backend/src/main/resources/openapi/components/schemas/PropertyType.yaml`:
```yaml
type: string
enum:
  - COMMERCIAL_OFFICE
  - RETAIL_PLAZA
  - INDUSTRIAL_PARK
  - MEDICAL_CENTER
```

- [ ] **Step 3: Update PropertyCreateRequest.yaml, PropertyResponse.yaml, and openapi.yaml**
Update `PropertyCreateRequest.yaml` to require `name`, `propertyType`, and `address`:
```yaml
type: object
required:
  - name
  - propertyType
  - address
properties:
  name:
    type: string
    example: "Grandview Office Tower"
  propertyType:
    $ref: './PropertyType.yaml'
  address:
    $ref: './Address.yaml'
```
Update `PropertyResponse.yaml` similarly:
```yaml
type: object
required:
  - propertyId
  - name
  - propertyType
  - address
  - status
properties:
  propertyId:
    type: string
    format: uuid
  name:
    type: string
  propertyType:
    $ref: './PropertyType.yaml'
  address:
    $ref: './Address.yaml'
  status:
    type: string
    example: "ACTIVE"
```
Register `Address` and `PropertyType` under `components/schemas` in `backend/src/main/resources/openapi/openapi.yaml`.

- [ ] **Step 4: Update V1__initial_schema.sql and delete V2__seed_properties.sql**
In `V1__initial_schema.sql`, replace the `properties` table definition with:
```sql
CREATE TABLE properties
(
    property_uuid    UUID PRIMARY KEY         DEFAULT gen_random_uuid(),
    name             VARCHAR(255)                                       NOT NULL,
    property_type    VARCHAR(50)              NOT NULL DEFAULT 'COMMERCIAL_OFFICE',
    address          JSONB                                              NOT NULL,
    status           VARCHAR(50)              NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_property_type CHECK (property_type IN ('COMMERCIAL_OFFICE', 'RETAIL_PLAZA', 'INDUSTRIAL_PARK', 'MEDICAL_CENTER'))
);

CREATE INDEX idx_properties_address_zip ON properties ((address->>'zipCode'));
```
Remove `backend/src/main/resources/db/migration/V2__seed_properties.sql`.

- [ ] **Step 5: Overhaul R__seed_test_data.sql with DB-generated UUIDs**
Rewrite `R__seed_test_data.sql`:
```sql
-- 1. Clean existing seed data (child tables first)
DELETE FROM audit_logs;
DELETE FROM invoices;
DELETE FROM property_vendor_mapping;
DELETE FROM vendors;
DELETE FROM properties;

-- 2. Seed Meaningful Properties (DB generates property_uuid)
INSERT INTO properties (name, property_type, address, status) VALUES
(
    'Grandview Office Tower',
    'COMMERCIAL_OFFICE',
    '{"streetAddress": "450 North Michigan Ave", "city": "Chicago", "state": "IL", "zipCode": "60611"}'::jsonb,
    'ACTIVE'
),
(
    'Harborfront Retail Plaza',
    'RETAIL_PLAZA',
    '{"streetAddress": "1200 Pacific Coast Hwy", "city": "Long Beach", "state": "CA", "zipCode": "90802"}'::jsonb,
    'ACTIVE'
),
(
    'Apex Commerce Hub',
    'INDUSTRIAL_PARK',
    '{"streetAddress": "8800 Interstate Parkway", "city": "Dallas", "state": "TX", "zipCode": "75241"}'::jsonb,
    'ACTIVE'
),
(
    'Metro Medical Pavilion',
    'MEDICAL_CENTER',
    '{"streetAddress": "7400 Fannin St", "city": "Houston", "state": "TX", "zipCode": "77054"}'::jsonb,
    'ACTIVE'
);

-- 3. Seed Meaningful Vendors (DB generates vendor_uuid)
INSERT INTO vendors (vendor_name, billing_phone_number, payment_method, status) VALUES
('Apex Utilities & HVAC', '555-0192', 'ACH', 'ACTIVE'),
('Beacon Fire & Life Safety', '555-0144', 'CHECK', 'ACTIVE'),
('Cornerstone Commercial Janitorial', '555-0188', 'CREDIT_CARD', 'ACTIVE');

-- 4. Map Vendor to Property dynamically (DB generates mapping_uuid)
INSERT INTO property_vendor_mapping (vendor_uuid, property_uuid, vendor_account_number, status, auto_approval_enabled)
SELECT 
    v.vendor_uuid,
    p.property_uuid,
    'ACT-9483920',
    'ACTIVE',
    TRUE
FROM vendors v, properties p
WHERE v.vendor_name = 'Apex Utilities & HVAC'
  AND p.name = 'Grandview Office Tower';

-- 5. Seed Initial Test Invoice dynamically (DB generates invoice_uuid)
INSERT INTO invoices (mapping_uuid, vendor_supplied_invoice_id, amount, invoice_status)
SELECT 
    m.mapping_uuid,
    'INV-2026-001',
    4500.00,
    'INGESTED'
FROM property_vendor_mapping m
WHERE m.vendor_account_number = 'ACT-9483920';
```

- [ ] **Step 6: Commit backend schema and migration changes**
```bash
git add backend/src/main/resources/
git commit -m "feat(backend): add Address & PropertyType schemas, update V1 schema, remove V2 seed, and update R seed with DB-generated UUIDs"
```

---

### Task 2: Backend Domain Model, Repository & Service Layer Update

**Files:**
- Create: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/model/AddressRecord.java`
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/entity/PropertyEntity.java`
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/repository/PropertyRepository.java`
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/service/PropertyService.java`

**Interfaces:**
- Consumes: OpenAPI generated `Address`, `PropertyType`, `PropertyCreateRequest`, `PropertyResponse`.
- Produces: `PropertyService.createProperty(PropertyCreateRequest)`, `PropertyService.getAllProperties()`, `PropertyRepository.existsByAddress(streetAddress, zipCode)`.

- [ ] **Step 1: Create AddressRecord POJO for JSONB mapping**
Create `AddressRecord.java`:
```java
package org.dsd.cohort2026fall.tdr.invoiceautomationservice.model;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AddressRecord {
    private String streetAddress;
    private String city;
    private String state;
    private String zipCode;
}
```

- [ ] **Step 2: Update PropertyEntity**
Update `PropertyEntity.java`:
```java
@Column(name = "property_type", nullable = false)
private String propertyType;

@JdbcTypeCode(SqlTypes.JSON)
@Column(name = "address", columnDefinition = "jsonb", nullable = false)
private AddressRecord address;

public PropertyResponse toResponse() {
    Address addressDto = address != null
        ? new Address(address.getStreetAddress(), address.getCity(), address.getState(), address.getZipCode())
        : null;
    PropertyType pType = propertyType != null ? PropertyType.fromValue(propertyType) : PropertyType.COMMERCIAL_OFFICE;
    return new PropertyResponse(propertyId, name, pType, addressDto, status);
}
```

- [ ] **Step 3: Update PropertyRepository JSONB query**
Update `PropertyRepository.java`:
```java
@Query(value = "SELECT COUNT(*) > 0 FROM properties WHERE LOWER(address->>'streetAddress') = LOWER(:streetAddress) AND address->>'zipCode' = :zipCode", nativeQuery = true)
Boolean existsByAddress(@Param("streetAddress") String streetAddress, @Param("zipCode") String zipCode);
```

- [ ] **Step 4: Update PropertyService implementation**
Update `createProperty` to take `request.getAddress()` and `request.getPropertyType()` and map into `PropertyEntity`:
```java
AddressRecord addr = request.getAddress() != null ? AddressRecord.builder()
        .streetAddress(request.getAddress().getStreetAddress())
        .city(request.getAddress().getCity())
        .state(request.getAddress().getState())
        .zipCode(request.getAddress().getZipCode())
        .build() : null;

PropertyEntity createdProperty = PropertyEntity.builder()
        .propertyId(UUID.randomUUID())
        .name(request.getName())
        .propertyType(request.getPropertyType() != null ? request.getPropertyType().getValue() : "COMMERCIAL_OFFICE")
        .address(addr)
        .status("ACTIVE")
        .build();
```

- [ ] **Step 5: Commit backend entity and service changes**
```bash
git add backend/src/main/java/
git commit -m "feat(backend): update PropertyEntity, PropertyRepository, and PropertyService for JSONB address and propertyType"
```

---

### Task 3: Frontend TypeScript Types & Two-Way Adapter Alignment

**Files:**
- Modify: `frontend/src/types/property.ts`
- Modify: `frontend/src/app/adapters/propertyAdapter.ts`
- Create: `frontend/tests/app/adapters/propertyAdapter.test.ts`

**Interfaces:**
- Consumes:
  - `AddressDTO`: `{ streetAddress: string; city: string; state: string; zipCode: string }`
  - `PropertyTypeDTO`: `'COMMERCIAL_OFFICE' | 'RETAIL_PLAZA' | 'INDUSTRIAL_PARK' | 'MEDICAL_CENTER'`
  - `PropertyResponse`: `{ propertyId: string; name: string; propertyType: PropertyTypeDTO; address: AddressDTO; status: string }`
  - `PropertyCreateRequest`: `{ name: string; propertyType: PropertyTypeDTO; address: AddressDTO }`
- Produces:
  - `toUIProperty(dto: PropertyResponse, existingUI?: UIProperty): UIProperty`
  - `toBackendPropertyCreate(form: CreatePropertyInput): PropertyCreateRequest`

- [ ] **Step 1: Write adapter unit tests**
Create `frontend/tests/app/adapters/propertyAdapter.test.ts` testing:
- Translating `PropertyResponse` with nested `address` and `COMMERCIAL_OFFICE` into `UIProperty` with formatted address and `commercial_office`.
- Converting discrete address fields into `PropertyCreateRequest` with nested `address` and converted `propertyType`.

- [ ] **Step 2: Update frontend types in `property.ts`**
Update `frontend/src/types/property.ts`:
```typescript
export type PropertyTypeDTO =
  | 'COMMERCIAL_OFFICE'
  | 'RETAIL_PLAZA'
  | 'INDUSTRIAL_PARK'
  | 'MEDICAL_CENTER';

export interface AddressDTO {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
}

export type Property = {
  propertyId: string;
  name: string;
  propertyType: PropertyTypeDTO;
  address: AddressDTO;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PropertyCreateRequest = {
  name: string;
  propertyType: PropertyTypeDTO;
  address: AddressDTO;
};

export type PropertyResponse = {
  propertyId: string;
  name: string;
  propertyType: PropertyTypeDTO;
  address: AddressDTO;
  status: string;
};
```

- [ ] **Step 3: Update `propertyAdapter.ts`**
Implement bidirectional type & address adapters:
```typescript
import type { Property as UIProperty, PayerPolicy } from '../../types';
import type { PropertyResponse, PropertyCreateRequest, PropertyTypeDTO, AddressDTO } from '../../types/property';
import { COMPANY_DEFAULT_POLICY } from '../../data/mockData';

export const UI_TO_BACKEND_PROPERTY_TYPE: Record<UIProperty['propertyType'], PropertyTypeDTO> = {
  commercial_office: 'COMMERCIAL_OFFICE',
  retail_plaza: 'RETAIL_PLAZA',
  industrial_park: 'INDUSTRIAL_PARK',
  medical_center: 'MEDICAL_CENTER',
};

export const BACKEND_TO_UI_PROPERTY_TYPE: Record<PropertyTypeDTO, UIProperty['propertyType']> = {
  COMMERCIAL_OFFICE: 'commercial_office',
  RETAIL_PLAZA: 'retail_plaza',
  INDUSTRIAL_PARK: 'industrial_park',
  MEDICAL_CENTER: 'medical_center',
};

export function toUIProperty(
  dto: PropertyResponse,
  existingUIProp?: UIProperty
): UIProperty {
  const addr = dto.address;
  const fullAddress = addr
    ? [addr.streetAddress, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', ')
    : '';

  const uiType = dto.propertyType
    ? (BACKEND_TO_UI_PROPERTY_TYPE[dto.propertyType] || 'commercial_office')
    : (existingUIProp?.propertyType || 'commercial_office');

  return {
    id: dto.propertyId,
    name: dto.name,
    address: fullAddress,
    propertyType: uiType,
    managerName: existingUIProp?.managerName || 'Operations Manager',
    sqft: existingUIProp?.sqft || 250000,
    policy: existingUIProp?.policy || { ...COMPANY_DEFAULT_POLICY },
    hasCustomPolicy: existingUIProp?.hasCustomPolicy ?? false,
  };
}

export interface CreatePropertyInput {
  name: string;
  propertyType: UIProperty['propertyType'];
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
}

export function toBackendPropertyCreate(input: CreatePropertyInput): PropertyCreateRequest {
  return {
    name: input.name.trim(),
    propertyType: UI_TO_BACKEND_PROPERTY_TYPE[input.propertyType] || 'COMMERCIAL_OFFICE',
    address: {
      streetAddress: input.streetAddress.trim(),
      city: input.city.trim(),
      state: input.state.trim().toUpperCase(),
      zipCode: input.zipCode.trim(),
    },
  };
}
```

- [ ] **Step 4: Verify frontend builds without errors**
Run `npm --prefix frontend run build` to confirm type checking.

- [ ] **Step 5: Commit adapter and types**
```bash
git add frontend/src/types/property.ts frontend/src/app/adapters/propertyAdapter.ts frontend/tests/app/adapters/
git commit -m "feat(frontend): align Property types and adapter to nested Address and PropertyTypeDTO"
```

---

### Task 4: Store & Service Layer Hookup (`useMasterData`)

**Files:**
- Modify: `frontend/src/app/services/propertyService.ts`
- Modify: `frontend/src/hooks/useMasterData.ts`
- Modify: `frontend/src/context/InvoiceContext.tsx`

**Interfaces:**
- Produces: `addNewProperty(data: CreatePropertyInput): Promise<Property>` exposed on `useInvoiceStore()` / `InvoiceContext`.

- [ ] **Step 1: Enhance `propertyService.ts`**
Export `createUIProperty(input: CreatePropertyInput): Promise<UIProperty>`:
```typescript
export async function createUIProperty(input: CreatePropertyInput): Promise<UIProperty> {
  const req = toBackendPropertyCreate(input);
  const dto = await createProperty(req);
  return toUIProperty(dto);
}
```

- [ ] **Step 2: Add `addNewProperty` to `useMasterData.ts`**
Implement in `useMasterData`:
```typescript
const addNewProperty = async (input: CreatePropertyInput): Promise<Property> => {
  try {
    const created = await createUIProperty(input);
    setProperties((prev) => [created, ...prev]);
    return created;
  } catch (err) {
    // Fallback: create local optimistic UI property if offline/backend down
    const localFallback: Property = {
      id: `prop-local-${Date.now()}`,
      name: input.name,
      address: `${input.streetAddress}, ${input.city}, ${input.state} ${input.zipCode}`,
      propertyType: input.propertyType,
      managerName: 'Operations Manager',
      sqft: 150000,
      policy: { ...COMPANY_DEFAULT_POLICY },
      hasCustomPolicy: false,
    };
    setProperties((prev) => [localFallback, ...prev]);
    return localFallback;
  }
};
```

- [ ] **Step 3: Expose `addNewProperty` in `InvoiceContext.tsx`**
Update `InvoiceContextType` and value provider to pass `addNewProperty`.

- [ ] **Step 4: Verify compilation**
Run `npm --prefix frontend run build`.

- [ ] **Step 5: Commit store and service changes**
```bash
git add frontend/src/app/services/propertyService.ts frontend/src/hooks/useMasterData.ts frontend/src/context/InvoiceContext.tsx
git commit -m "feat(frontend): expose addNewProperty in master data hook and InvoiceContext"
```

---

### Task 5: Create Property UI Modal with Individual Address Fields

**Files:**
- Create: `frontend/src/components/CreatePropertyModal.tsx`
- Modify: `frontend/src/components/PayerPolicyRules.tsx`

**Interfaces:**
- Consumes: `addNewProperty(input: CreatePropertyInput)` from `useInvoiceStore()`.
- Produces: Modal with validated inputs for `name`, `propertyType`, `streetAddress`, `city`, `state`, `zipCode`.

- [ ] **Step 1: Build `CreatePropertyModal.tsx`**
Create modal dialog with:
- Property Name input.
- Property Type dropdown (`commercial_office`, `retail_plaza`, `industrial_park`, `medical_center`).
- Address section with 4 discrete inputs:
  - Street Address (`streetAddress`)
  - City (`city`)
  - State (`state`, 2-letter uppercase)
  - ZIP Code (`zipCode`)
- Form validation (required checks, postal code pattern).
- Loading and error states.
- Submission handler calling `addNewProperty`.

- [ ] **Step 2: Add "Add Property" button in `PayerPolicyRules.tsx`**
Add an "Add Property" button in the Payer Policy header:
- Opening modal on click.
- Table immediately displays the newly created property.

- [ ] **Step 3: Verify build and UI layout**
Run: `npm --prefix frontend run build`.

- [ ] **Step 4: Commit UI components**
```bash
git add frontend/src/components/CreatePropertyModal.tsx frontend/src/components/PayerPolicyRules.tsx
git commit -m "feat(frontend): add CreatePropertyModal with discrete address fields to Payer Policy view"
```

---

### Task 6: End-to-End Verification & Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-11-06-fe-be-plumbing-phased-hybrid.md`

- [ ] **Step 1: Run production frontend build and lint check**
Run: `npm --prefix frontend run build && npm --prefix frontend run lint`.
Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Update phased hybrid plan doc**
Update milestone tracking in `docs/superpowers/plans/2026-11-06-fe-be-plumbing-phased-hybrid.md` to document the completed Property JSONB address alignment, PropertyType, and creation modal.

- [ ] **Step 3: Commit plan documentation**
```bash
git add docs/superpowers/plans/
git commit -m "docs: update implementation plan with Property JSONB address & PropertyType integration"
```
