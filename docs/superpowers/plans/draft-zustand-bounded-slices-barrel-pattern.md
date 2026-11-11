# Draft: Frontend State Management Architecture (Bounded Slices + Barrel Pattern + Zustand)

> **Status:** Draft / Stashed for future implementation.
> **Context:** To be executed after invoice approval policy configuration and backend endpoint readiness.

## 1. Architectural Overview

Migrate the frontend state management from the monolithic, re-render-heavy `InvoiceContext.tsx` to a unified, type-safe Zustand store leveraging:
1. **Bounded Slices Pattern**: Domain-specific state slices (`auth`, `filter`, `masterData`, `invoice`) isolated into small, maintainable files.
2. **Barrel Pattern**: A single entry point (`src/stores/index.ts`) exposing the consolidated `useAppStore` hook and reusable selectors.
3. **OpenAPI Integration**: Direct consumption of generated DTO contracts from `@/types/api` and the typed `apiClient` (`openapi-fetch`), mediated by our existing adapter layer (`propertyAdapter.ts`, `vendorAdapter.ts`).

---

## 2. Target File Structure

```
frontend/src/
├── stores/
│   ├── index.ts                     # Barrel: exports useAppStore, selectors, and slice types
│   ├── useAppStore.ts               # Root store combining slices: create<AppState>()(...)
│   └── slices/
│       ├── createAuthSlice.ts       # currentUser, activeRole, roleProfiles
│       ├── createFilterSlice.ts     # activeTab, searchQuery, propertyFilter
│       ├── createMasterDataSlice.ts # properties, vendors, mappings, GL accounts, categories
│       └── createInvoiceSlice.ts    # invoices, approvals queue, exception inbox, uploads
```

---

## 3. Slice Definitions

### A. Auth Slice (`createAuthSlice.ts`)
- **State**: `currentUser: AppUser`, `activeRole: UserRole`, `currentProfile: RoleProfile`, `availableUsers: AppUser[]`.
- **Actions**: `setCurrentUser(user)`, `setActiveRole(role)`.

### B. Filter Slice (`createFilterSlice.ts`)
- **State**: `activeTab: NavTab`, `searchQuery: string`, `propertyFilter: string`.
- **Actions**: `setActiveTab(tab)`, `setSearchQuery(query)`, `setPropertyFilter(propertyId)`.

### C. Master Data Slice (`createMasterDataSlice.ts`)
- **State**: 
  - `properties: Property[]`, `isPropertiesLive: boolean`
  - `vendors: Vendor[]`, `isVendorsLive: boolean`
  - `propertyCategories: PropertyCategoryResponse[]`
  - `vendorCategories: VendorCategoryResponse[]`
  - `paymentMethods: PaymentMethodResponse[]`
  - `mappings: PropertyVendorRelationship[]`
  - `glAccountsByProperty: Record<string, PropertyGlAccountResponse[]>`
- **Actions**:
  - `fetchProperties(): Promise<void>`
  - `addNewProperty(input: CreatePropertyInput): Promise<Property>`
  - `fetchVendors(): Promise<void>`
  - `addNewVendor(input: CreateVendorInput): Promise<Vendor>`
  - `fetchGlAccounts(propertyId: string): Promise<PropertyGlAccountResponse[]>`
  - `updateMappingTerms(mappingId: string, updates: { costType: string; defaultGlCode?: string })`
  - `toggleAutoApproval(mappingId: string)`

### D. Invoice Slice (`createInvoiceSlice.ts`)
- **State**:
  - `invoices: Invoice[]`
  - `activities: ActivityItem[]`
  - `uploadStatus: { isUploading: boolean; error: string | null }`
- **Actions**:
  - `fetchInvoices(): Promise<void>` (interim mockData fallback until backend endpoint lands)
  - `uploadInvoiceFile(file: File): Promise<InvoiceUploadResponse>` (via `invoiceUploadService`)
  - `approveInvoice(invoiceId: string)`
  - `rejectInvoice(invoiceId: string, reason: string)`

---

## 4. Migration Strategy

1. **Phase 1 - Store Scaffolding**: Create `stores/slices/` and `useAppStore.ts` with TypeScript types.
2. **Phase 2 - Slice Implementation**: Implement slices calling `apiClient` and adapters.
3. **Phase 3 - Component Re-binding**: Update UI components from `useInvoiceStore()` (Context) to `useAppStore((s) => s.sliceProp)`.
4. **Phase 4 - Decommissioning**: Delete `InvoiceContext.tsx` and legacy hooks (`useMasterData.ts`, `useInvoices.ts`).

