# Reference Data & Category Metadata Implementation Plan (Vendor & Property Categories Tables & Payment Methods)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize on dedicated reference tables for both **`property_categories`** and **`vendor_categories`**, establishing foreign key relationships in `properties.category` and `vendors.category`, exposing dynamic REST endpoints (`/api/v1/vendors/categories`, `/api/v1/properties/categories`, `/api/v1/vendors/payment-methods`), and wiring them into the frontend creation/onboarding modals.

**Architecture:**
- **Database & Migration (`V1__initial_schema.sql` & `R__seed_test_data.sql`)**:
  - Table `property_categories` (`category_code VARCHAR(100) PRIMARY KEY`, `name VARCHAR(255) NOT NULL`, `description VARCHAR(500)`).
  - Table `vendor_categories` (`category_code VARCHAR(100) PRIMARY KEY`, `name VARCHAR(255) NOT NULL`, `description VARCHAR(500)`).
  - In `properties` table, column `category VARCHAR(100)` foreign keys to `property_categories(category_code)`.
  - In `vendors` table, column `category VARCHAR(100)` foreign keys to `vendor_categories(category_code)`.
  - Repeatable seed `R__seed_test_data.sql` cleanly clears and seeds both reference tables, properties, and vendors.
- **Backend Metadata Endpoints (OpenAPI & Controllers)**:
  - `GET /api/v1/vendors/categories`: returns list of `VendorCategoryResponse` (`categoryCode`, `name`, `description`).
  - `GET /api/v1/properties/categories`: returns list of `PropertyCategoryResponse` (`categoryCode`, `name`, `description`).
  - `GET /api/v1/vendors/payment-methods`: returns list of `PaymentMethod` enum values (`ACH`, `CHECK`, `CREDIT_CARD`).
- **Backend Entities & Repositories**:
  - `PropertyCategoryEntity` & `PropertyCategoryRepository`.
  - `VendorCategoryEntity` & `VendorCategoryRepository`.
  - Update `PropertyEntity` and `VendorEntity` to reference category strings / entities.
  - Implement endpoints in `PropertyController` and `VendorController`.
- **Frontend Integration**:
  - Reference data hooks / service (`metadataService.ts`) to fetch categories and payment methods.
  - Populate dropdowns dynamically in `CreateVendorModal.tsx` and `CreatePropertyModal.tsx` with offline fallback constants.

**Tech Stack:** Spring Boot 4 / Java 21, Flyway, PostgreSQL, OpenAPI Generator, React 19, TypeScript, Tailwind CSS, Lucide icons.

---

## Global Constraints
- **Terminology & Schema Consistency**: Dedicated reference tables for both: `property_categories` and `vendor_categories`. Both `properties` and `vendors` have a `category` column foreign-keyed to their respective reference table.
- **Zero TypeScript Errors**: `npm --prefix frontend run build` must succeed after each task.
- **RESTful Path Consistency**: Use `/api/v1/` prefix matching existing endpoints (`/api/v1/vendors/categories`, `/api/v1/properties/categories`, `/api/v1/vendors/payment-methods`).
- **No Hardcoded Seed Keys**: Let seeds populate cleanly in `R__seed_test_data.sql` and clean child-to-parent dependencies.
- **Offline Fallback**: Frontend modals must maintain local default fallback arrays if the metadata endpoints fail or backend is offline.

---

## Review Focus
1. **Foreign Key Integrity**: Creating a property or vendor with a selected `category` must validate against its respective category table.
2. **Dynamic Dropdown Population**: Adding a category in either `property_categories` or `vendor_categories` table must immediately reflect in the respective modal dropdown.
3. **Modal UX**: Loading states in `CreateVendorModal` and `CreatePropertyModal` while categories are fetched, with zero UI stutter.
4. **Contract Uniformity**: OpenAPI specs must document all metadata endpoints with typed response schemas.
5. **Clean Seeding**: `R__seed_test_data.sql` must clean child-to-parent tables without foreign key constraint violations.

---

### Task 1: Database Schema for `property_categories` & `vendor_categories` and Seed Overhaul

**Files:**
- Modify: `backend/src/main/resources/db/migration/V1__initial_schema.sql`
- Modify: `backend/src/main/resources/db/migration/R__seed_test_data.sql`

**Interfaces:**
- Produces: Tables `property_categories` and `vendor_categories` with foreign keys from `properties.category` and `vendors.category`.

- [ ] **Step 1: Update V1__initial_schema.sql**
In `V1__initial_schema.sql`:
```sql
CREATE TABLE property_categories
(
    category_code VARCHAR(100) PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    description   VARCHAR(500),
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE properties
(
    property_uuid    UUID PRIMARY KEY         DEFAULT gen_random_uuid(),
    name             VARCHAR(255)                                       NOT NULL,
    category         VARCHAR(100)             NOT NULL REFERENCES property_categories (category_code) ON DELETE RESTRICT,
    address          JSONB                                              NOT NULL,
    status           VARCHAR(50)              NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_properties_address_zip ON properties ((address->>'zipCode'));

CREATE TABLE vendor_categories
(
    category_code VARCHAR(100) PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    description   VARCHAR(500),
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE vendors
(
    vendor_uuid          UUID PRIMARY KEY         DEFAULT gen_random_uuid(),
    vendor_name          VARCHAR(255)             NOT NULL,
    category             VARCHAR(100)             REFERENCES vendor_categories (category_code) ON DELETE SET NULL,
    tax_id               VARCHAR(50),
    billing_phone_number VARCHAR(255),
    status               VARCHAR(255)             NOT NULL DEFAULT 'ACTIVE',
    payment_url          VARCHAR(225),
    payment_method       VARCHAR(255)             NOT NULL DEFAULT 'ACH',
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_payment_method CHECK ( payment_method IN ('CHECK', 'CREDIT_CARD', 'ACH')),
    CONSTRAINT check_status CHECK ( status IN ('ACTIVE', 'INACTIVE'))
);
```

- [ ] **Step 2: Update R__seed_test_data.sql**
Clean and seed both category tables, properties, and vendors:
```sql
-- 1. Clean existing seed data (child tables first)
DELETE FROM audit_logs;
DELETE FROM invoices;
DELETE FROM property_vendor_mapping;
DELETE FROM vendors;
DELETE FROM properties;
DELETE FROM vendor_categories;
DELETE FROM property_categories;

-- 2. Seed Property Categories
INSERT INTO property_categories (category_code, name, description) VALUES
('COMMERCIAL_OFFICE', 'Commercial Office Tower', 'Multi-tenant high-rise and suburban corporate office properties'),
('RETAIL_PLAZA', 'Retail Plaza & Shopping Center', 'Open-air strip centers, grocery-anchored plazas, and regional malls'),
('INDUSTRIAL_PARK', 'Industrial Logistics Hub', 'Distribution warehouses, flex spaces, and manufacturing parks'),
('MEDICAL_CENTER', 'Medical Center Pavilion', 'Healthcare clinics, surgical centers, and outpatient medical facilities');

-- 3. Seed Vendor Categories
INSERT INTO vendor_categories (category_code, name, description) VALUES
('UTILITIES_ENERGY', 'Utilities & Energy Management', 'Electric, water, gas, solar, and utility monitoring'),
('HVAC_MECHANICAL', 'HVAC & Mechanical Systems', 'Heating, cooling, boilers, chillers, and preventative HVAC maintenance'),
('JANITORIAL_CLEANING', 'Janitorial & Cleaning Services', 'Commercial daily office cleaning, trash removal, and sanitization'),
('FIRE_LIFE_SAFETY', 'Fire & Life Safety Systems', 'Fire alarms, sprinkler inspections, extinguishers, and emergency lighting'),
('SECURITY_ACCESS', 'Security & Access Control', 'Physical security, keycard access controls, and video surveillance'),
('ELEVATOR_VERTICAL', 'Elevator & Vertical Transport', 'Elevator inspections, maintenance contracts, and cab servicing'),
('LANDSCAPING_GROUNDS', 'Landscaping & Grounds Care', 'Groundskeeping, irrigation, snow removal, and exterior maintenance'),
('GENERAL_MAINTENANCE', 'General Facility Maintenance', 'Handyman, lock repair, painting, drywall, and structural maintenance');

-- 4. Seed Properties using category foreign key
INSERT INTO properties (name, category, address, status) VALUES
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

-- 5. Seed Vendors using category foreign key
INSERT INTO vendors (vendor_name, category, tax_id, billing_phone_number, payment_method, status) VALUES
('Apex Utilities & HVAC', 'UTILITIES_ENERGY', '12-3456789', '555-0192', 'ACH', 'ACTIVE'),
('Beacon Fire & Life Safety', 'FIRE_LIFE_SAFETY', '98-7654321', '555-0144', 'CHECK', 'ACTIVE'),
('Cornerstone Commercial Janitorial', 'JANITORIAL_CLEANING', '45-6789012', '555-0188', 'CREDIT_CARD', 'ACTIVE');
```

- [ ] **Step 3: Commit database migration and seed updates**
```bash
git add backend/src/main/resources/db/migration/
git commit -m "feat(backend): add property_categories and vendor_categories tables with foreign keys"
```

---

### Task 2: OpenAPI Contract for Category Metadata & Category DTOs

**Files:**
- Create: `backend/src/main/resources/openapi/components/schemas/PropertyCategoryResponse.yaml`
- Create: `backend/src/main/resources/openapi/components/schemas/VendorCategoryResponse.yaml`
- Modify: `backend/src/main/resources/openapi/components/schemas/PropertyCreateRequest.yaml`
- Modify: `backend/src/main/resources/openapi/components/schemas/PropertyResponse.yaml`
- Modify: `backend/src/main/resources/openapi/components/schemas/VendorCreateRequest.yaml`
- Modify: `backend/src/main/resources/openapi/components/schemas/VendorResponse.yaml`
- Modify: `backend/src/main/resources/openapi/openapi.yaml`

**Interfaces:**
- Produces:
  - `GET /api/v1/properties/categories`: returns array of `PropertyCategoryResponse` (`categoryCode`, `name`, `description`).
  - `GET /api/v1/vendors/categories`: returns array of `VendorCategoryResponse` (`categoryCode`, `name`, `description`).
  - `GET /api/v1/vendors/payment-methods`: returns array of `PaymentMethod` strings (`ACH`, `CHECK`, `CREDIT_CARD`).
  - `PropertyCreateRequest` / `PropertyResponse`: use `category: string` (category code).
  - `VendorCreateRequest` / `VendorResponse`: use `category: string` and `taxId: string`.

- [ ] **Step 1: Create PropertyCategoryResponse.yaml & VendorCategoryResponse.yaml**
Define `PropertyCategoryResponse.yaml`:
```yaml
type: object
required:
  - categoryCode
  - name
properties:
  categoryCode:
    type: string
    example: "COMMERCIAL_OFFICE"
  name:
    type: string
    example: "Commercial Office Tower"
  description:
    type: string
    example: "Multi-tenant high-rise and suburban corporate office properties"
```
Define `VendorCategoryResponse.yaml`:
```yaml
type: object
required:
  - categoryCode
  - name
properties:
  categoryCode:
    type: string
    example: "UTILITIES_ENERGY"
  name:
    type: string
    example: "Utilities & Energy Management"
  description:
    type: string
    example: "Electric, water, gas, solar, and utility monitoring"
```

- [ ] **Step 2: Update Request & Response Schemas**
In `PropertyCreateRequest.yaml` and `PropertyResponse.yaml`, use `category: string`.
In `VendorCreateRequest.yaml`, `VendorUpdateRequest.yaml`, and `VendorResponse.yaml`, use `category: string` and `taxId: string`.

- [ ] **Step 3: Register schemas and routes in openapi.yaml**
Register endpoints:
- `/api/v1/properties/categories`
- `/api/v1/vendors/categories`
- `/api/v1/vendors/payment-methods`

- [ ] **Step 4: Commit OpenAPI specs**
```bash
git add backend/src/main/resources/openapi/
git commit -m "feat(backend): define OpenAPI routes and response schemas for property and vendor categories"
```

---

### Task 3: Backend Entities, Repositories, and Controller Implementations

**Files:**
- Create: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/entity/PropertyCategoryEntity.java`
- Create: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/repository/PropertyCategoryRepository.java`
- Create: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/entity/VendorCategoryEntity.java`
- Create: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/repository/VendorCategoryRepository.java`
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/entity/PropertyEntity.java`
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/service/PropertyService.java`
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/controller/PropertyController.java`
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/entity/VendorEntity.java`
- Modify: `backend/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/controller/VendorController.java`

**Interfaces:**
- Produces:
  - `PropertyController.getPropertyCategories()` -> `List<PropertyCategoryResponse>`
  - `VendorController.getVendorCategories()` -> `List<VendorCategoryResponse>`
  - `VendorController.getPaymentMethods()` -> `List<PaymentMethod>`

- [ ] **Step 1: Implement Category Entities & Repositories**
Implement `PropertyCategoryEntity` and `PropertyCategoryRepository`.
Implement `VendorCategoryEntity` and `VendorCategoryRepository`.

- [ ] **Step 2: Update PropertyEntity, PropertyService, and PropertyController**
In `PropertyEntity.java`: use `@Column(name = "category") private String category;`.
In `PropertyService.java`: map `request.getCategory()`.
In `PropertyController.java`: add `GET /api/v1/properties/categories` returning `propertyCategoryRepository.findAll().stream().map(PropertyCategoryEntity::toResponse).toList()`.

- [ ] **Step 3: Update VendorEntity and VendorController**
In `VendorEntity.java`: add `category` and `taxId`.
In `VendorController.java`: map `category` and `taxId`. Add endpoints:
- `GET /api/v1/vendors/categories` returning `vendorCategoryRepository.findAll().stream().map(VendorCategoryEntity::toResponse).toList()`.
- `GET /api/v1/vendors/payment-methods` returning `List.of(PaymentMethod.ACH, PaymentMethod.CHECK, PaymentMethod.CREDIT_CARD)`.

- [ ] **Step 4: Commit backend entity & controller updates**
```bash
git add backend/src/main/java/
git commit -m "feat(backend): implement property and vendor category entities, repos, and controller endpoints"
```

---

### Task 4: Frontend Types, Adapters & Metadata Service Layer

**Files:**
- Create: `frontend/src/types/metadata.ts`
- Create: `frontend/src/app/services/metadataService.ts`
- Modify: `frontend/src/types/property.ts`
- Modify: `frontend/src/types/vendor.ts`
- Modify: `frontend/src/app/adapters/propertyAdapter.ts`
- Modify: `frontend/src/app/adapters/vendorAdapter.ts`
- Modify: `frontend/src/hooks/useMasterData.ts`

**Interfaces:**
- Produces:
  - `CategoryDTO`: `{ categoryCode: string; name: string; description?: string }`
  - `metadataService.ts`: `fetchPropertyCategories()`, `fetchVendorCategories()`, `fetchPaymentMethods()`
  - `useMasterData`: exposes `propertyCategories`, `vendorCategories`, `paymentMethods`, `addNewProperty`, `addNewVendor`

- [ ] **Step 1: Create frontend/src/types/metadata.ts and align property.ts & vendor.ts**
Define `CategoryDTO` in `metadata.ts`.
In `property.ts`: update to `category: string`.
In `vendor.ts`: add `category?: string` and `taxId?: string`.

- [ ] **Step 2: Update propertyAdapter.ts and vendorAdapter.ts**
In `propertyAdapter.ts`: map `category` cleanly between backend code and UI label/type.
In `vendorAdapter.ts`: roundtrip `category` and `taxId`.

- [ ] **Step 3: Implement metadataService.ts and wire into useMasterData.ts**
Fetch metadata on mount with reliable static fallbacks.
Implement `addNewVendor` and update `addNewProperty` to accept `category`.

- [ ] **Step 4: Verify compilation**
Run: `npm --prefix frontend run build`.

- [ ] **Step 5: Commit frontend types, adapters & services**
```bash
git add frontend/src/types/ frontend/src/app/ frontend/src/hooks/
git commit -m "feat(frontend): add metadataService and align adapters on category"
```

---

### Task 5: Build `CreateVendorModal` & Update `CreatePropertyModal` with Dynamic Categories

**Files:**
- Create: `frontend/src/components/CreateVendorModal.tsx`
- Modify: `frontend/src/components/CreatePropertyModal.tsx`
- Modify: `frontend/src/components/PropertyVendorMatching.tsx`

**Interfaces:**
- Consumes: Dynamic `propertyCategories`, `vendorCategories`, and `paymentMethods` from `useInvoiceStore()`.
- Produces: Polished Vendor onboarding modal and dynamic Property category dropdown.

- [ ] **Step 1: Create CreateVendorModal.tsx**
Create onboarding modal:
- Vendor Legal Name
- Category dropdown populated from `vendorCategories`
- Payment Method selector (`ACH`, `CHECK`, `CREDIT_CARD`)
- Tax ID / EIN input
- Phone Number, Payment Portal URL, Remittance Address inputs
- Submits to `addNewVendor`

- [ ] **Step 2: Update CreatePropertyModal.tsx**
Populate category dropdown dynamically from `propertyCategories`.

- [ ] **Step 3: Add "+ Onboard Vendor" button in PropertyVendorMatching.tsx**
Surface button on the Active Mappings Directory tab next to the API status badge.

- [ ] **Step 4: Verify production build**
Run: `npm --prefix frontend run build`.
Expected: 0 errors.

- [ ] **Step 5: Commit UI components**
```bash
git add frontend/src/components/CreateVendorModal.tsx frontend/src/components/CreatePropertyModal.tsx frontend/src/components/PropertyVendorMatching.tsx
git commit -m "feat(frontend): create CreateVendorModal and wire dynamic categories into creation modals"
```

---

### Task 6: Final Verification & Plan Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-11-06-fe-be-plumbing-phased-hybrid.md`

- [ ] **Step 1: Run production frontend build and lint check**
Run: `npm --prefix frontend run build`.
Expected: 0 errors.

- [ ] **Step 2: Update phased hybrid plan doc**
Record completion of standardized `property_categories` and `vendor_categories` tables, metadata endpoints, and Vendor Onboarding modal.

- [ ] **Step 3: Commit plan doc**
```bash
git add docs/superpowers/plans/
git commit -m "docs: update plan with property_categories, vendor_categories, and metadata endpoints"
```
