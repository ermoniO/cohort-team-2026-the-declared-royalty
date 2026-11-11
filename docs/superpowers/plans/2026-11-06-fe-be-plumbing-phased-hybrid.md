# Frontend-to-Backend Plumbing & Domain Refinement Implementation Plan (Phased Hybrid)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Iron out domain contradictions in the frontend (user modeling, property manager scoping, role UX, and standalone property-vendor mappings) and plumb the accounts payable application to the backend REST API starting with overlapping master data entities (`Property` [completed], `Vendor` [completed], `User`, `Invoice Upload & Duplicate Check`) via typed adapters.

**Architecture:** A 4-tier client architecture: 
1. **Typed Backend DTOs & REST Services** (`apiClient.ts` + entity services), 
2. **Two-way Typed Adapters** (`toUI<Entity>` / `toBackend<Entity>`), 
3. **Reactive React Store** (`InvoiceContext.tsx`) with user-scoping, automatic API synchronization, and offline fallback, 
4. **High-density UI Views** with live connection status indicators and authenticated user session simulation.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Lucide icons, Spring Boot REST API, PostgreSQL.

**Spec:** `/Users/spira/Documents/Projects/invoice-processing-frontend/.aistudio/artifacts/brain/ac3f9115-dd2d-4cd4-822d-fe0c933a8a1a/implementation_plan.md`

## Global Constraints
- **User Modeling**: Distinct users (`AppUser`) with roles (`UserRole`) and assigned properties (`assignedPropertyIds`), decoupling personal identity from role permissions.
- **Property Manager Scoping**: Users with `property_manager` role can only see and manage properties assigned to them (`assignedPropertyIds`), while global roles (`ap_specialist`, `vp_finance`, `admin_auditor`) have portfolio-wide access.
- **Role Display & Session UX**: TopBar displays a clean, read-only active user/role indicator; user switching is triggered from the bottom-left sidebar user profile footer.
- **Standalone Mappings**: Standalone Property-to-Vendor relationships exist independently of invoices via an "Active Mappings Directory" tab in the matching view.
- **PaymentMethod Alignment**: Standardized across frontend and backend to `'ACH' | 'CHECK' | 'CREDIT_CARD'`.
- **Zero TypeScript Errors**: `npm --prefix frontend run build` must succeed after each task.

---

### Task 1: [COMPLETED] Property Entity Refinement & Plumbing Blueprint
- [x] Remove `code: string` from `frontend/src/types.ts` `Property` interface.
- [x] Remove `code` definitions from `INITIAL_PROPERTIES` in `frontend/src/data/mockData.ts`.
- [x] Create `frontend/src/app/adapters/propertyAdapter.ts` with `toUIProperty` and `toBackendPropertyCreate`.
- [x] Add `fetchUIProperties()` to `frontend/src/app/services/propertyService.ts`.
- [x] Wire `isPropertiesLive`, `refreshProperties` in `frontend/src/context/InvoiceContext.tsx`.
- [x] Surface street address and square footage in `frontend/src/components/PayerPolicyRules.tsx` and add backend status pill.
- [x] Verify frontend builds with zero TypeScript errors.

---

### Task 2: [COMPLETED] Domain Model Refinement — Users, Role Profiles & Property Scoping
- [x] Define `AppUser` interface and decouple from `RoleProfile` in `frontend/src/types.ts`.
- [x] Seed realistic users in `frontend/src/data/mockData.ts` with distinct roles and assigned property IDs.
- [x] Update `InvoiceContext.tsx` with user state, `scopedProperties`, and persona switching.
- [x] Verify frontend builds with zero TypeScript errors.

---

### Task 3: [COMPLETED] Refactor Role Switcher UX — TopBar & Sidebar User Switcher
- [x] Create `frontend/src/components/UserSwitcherModal.tsx`.
- [x] Refactor `frontend/src/components/TopBar.tsx` to display read-only authenticated session badge and scoped property filter.
- [x] Enhance Sidebar User Profile Footer in `frontend/src/components/Sidebar.tsx` with persona switch button.
- [x] Verify build and interactions.

---

### Task 4: [COMPLETED] Standalone Property-Vendor Mappings Directory
- [x] Add `PropertyVendorRelationship` domain model in `frontend/src/types.ts` and seed `INITIAL_PROPERTY_VENDOR_MAPPINGS` in `frontend/src/data/mockData.ts`.
- [x] Add store methods `mappings`, `toggleAutoApproval`, and `addMapping` in `frontend/src/context/InvoiceContext.tsx`.
- [x] Update `frontend/src/components/PropertyVendorMatching.tsx` with Two-Tab Architecture ("Active Mappings Directory" and "Invoice Match Triage").
- [x] Verify build with zero errors.

---

### Task 5: [COMPLETED] Vendor Entity Refinement & Backend Adapter Integration
- [x] Align `PaymentMethod` across types and mock data to `'ACH' | 'CHECK' | 'CREDIT_CARD'` and update `PaymentHub.tsx`.
- [x] Build `frontend/src/app/adapters/vendorAdapter.ts` with `toUIVendor` and `toBackendVendorCreate`.
- [x] Enhance `frontend/src/app/services/vendorService.ts` with `fetchUIVendors()`.
- [x] Wire live vendor fetching (`isVendorsLive`, `refreshVendors`) into `frontend/src/context/InvoiceContext.tsx`.
- [x] Add vendor connection status indicator in `frontend/src/components/PropertyVendorMatching.tsx`.
- [x] Verify production build passes cleanly.

---

### Task 6: [COMPLETED] Property Entity JSONB Address, PropertyType & Creation Modal
- [x] Update OpenAPI contract with `Address.yaml` and `PropertyType.yaml` schemas.
- [x] Define `address JSONB` and `property_type` in `V1__initial_schema.sql` and remove redundant `V2__seed_properties.sql`.
- [x] Reseed `R__seed_test_data.sql` with real-world properties, vendors, mappings, and invoices using database-generated UUIDs.
- [x] Update backend `PropertyEntity`, `PropertyRepository`, and `PropertyService` using `AddressRecord` Java record and `@JdbcTypeCode(SqlTypes.JSON)`.
- [x] Align frontend `PropertyResponse` / `PropertyCreateRequest` with `AddressDTO` and `PropertyTypeDTO` in `frontend/src/types/property.ts`.
- [x] Update `frontend/src/app/adapters/propertyAdapter.ts` with bidirectional mapping and discrete address fields.
- [x] Wire `addNewProperty` into `frontend/src/hooks/useMasterData.ts` and `frontend/src/context/InvoiceContext.tsx`.
- [x] Implement `CreatePropertyModal.tsx` and integrate "Add Property" button in `PayerPolicyRules.tsx`.
- [x] Verify frontend builds with zero TypeScript errors.

---

### Next Milestones:
- **Milestone 7: User Entity Backend Plumbing** (`userService.ts` & `userAdapter.ts` to sync with `/api/v1/users`).
- **Milestone 8: Invoice Upload & Duplicate Detection Plumbing** (`invoiceUploadService.ts` to integrate client-side SHA-256 hash calculation with `/api/v1/invoice-uploads/check-duplicates`).
