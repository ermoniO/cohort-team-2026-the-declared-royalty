# OpenAPI-TypeScript & OpenAPI-Fetch Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate `openapi-typescript` and `openapi-fetch` into the frontend to generate type-safe API contracts directly from `backend/src/main/resources/openapi/openapi.yaml`, replace hand-rolled fetch wrappers in `apiClient.ts`, and switch services/adapters to direct OpenAPI schema types (Option B), eliminating manual DTO maintenance.

**Architecture:** A single generated TypeScript contract file (`src/types/api.generated.ts`) is generated from the multi-file backend OpenAPI specification. An `openapi-fetch` client bound to the generated `paths` provides compile-time validated HTTP methods, endpoints, parameters, and responses. Services and adapters consume generated types directly via `components['schemas']` instead of manual DTO files.

**Tech Stack:** React 19, TypeScript 5.8+, Vite 8, `openapi-typescript`, `openapi-fetch`.

**Spec:** Option B: Direct import from `@/types/api.generated` (or typed schema helper), deprecating hand-written DTO files (`property.ts`, `vendor.ts`, `metadata.ts`).

## Global Constraints

- Backend OpenAPI specification (`backend/src/main/resources/openapi/openapi.yaml`) remains the single source of truth.
- Frontend UI domain models in `src/types.ts` (`Property`, `Vendor`, `Invoice`, `PayerPolicy`) must be preserved as the active models for UI component state.
- Hand-written DTO files in `src/types/` (`property.ts`, `vendor.ts`, `metadata.ts`) must be completely superseded and removed or deprecated.
- Every service call must use typed endpoint routes and parameters via `apiClient.GET`, `apiClient.POST`, `apiClient.PUT`.
- All changes must pass `npm --prefix frontend run build` with 0 TypeScript errors.

## Review Focus

1. **Route Typo & Param Safety:** Verify that changing a backend route or path variable (e.g. `vendorUuid`) produces a TypeScript compiler error immediately in `vendorService.ts`.
2. **Schema Synchronization:** Verify that all OpenAPI schemas (`PropertyResponse`, `VendorResponse`, `PaymentMethodResponse`, `CategoryItem`) generated match the latest backend schema including soft-delete `status` and `updatedAt`.
3. **HTTP 204 & Empty Response Handling:** Verify that `openapi-fetch` handles 204 or void endpoints gracefully without throwing JSON parsing exceptions.
4. **Adapter Isolation:** Verify that UI components (`CreatePropertyModal`, `CreateVendorModal`, `PropertyVendorMatching`) continue receiving UI models (`Property`, `Vendor`) without needing direct coupling to raw backend DTO shapes.
5. **Clean Deprecation:** Verify that no orphaned imports point to the deleted or deprecated hand-written DTO files.

---

## Tasks

### Task 1: Scaffolding, Dependencies, and Codegen Script

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/types/api.generated.ts` (generated artifact)
- Create: `frontend/src/types/api.ts` (convenience schema helpers)

- [ ] **Step 1: Install dependencies**
  Install `openapi-fetch` as runtime dependency and `openapi-typescript` as devDependency in `frontend/package.json`:
  ```bash
  npm --prefix frontend install openapi-fetch
  npm --prefix frontend install -D openapi-typescript
  ```

- [ ] **Step 2: Add codegen script to `frontend/package.json`**
  Add script `"generate:api"`:
  ```json
  "scripts": {
    "generate:api": "openapi-typescript ../backend/src/main/resources/openapi/openapi.yaml -o ./src/types/api.generated.ts",
    "prebuild": "npm run generate:api",
    ...
  }
  ```

- [ ] **Step 3: Execute initial codegen**
  Run `npm --prefix frontend run generate:api` and confirm `frontend/src/types/api.generated.ts` is created and exports `paths`, `operations`, and `components`.

- [ ] **Step 4: Create convenient schema type accessor (`src/types/api.ts`)**
  Create `frontend/src/types/api.ts` to export helper aliases for clean access across services and adapters:
  ```typescript
  import type { components, paths } from './api.generated';

  export type { paths, components };
  export type Schema<T extends keyof components['schemas']> = components['schemas'][T];

  // Primary API DTO Aliases
  export type PropertyResponse = Schema<'PropertyResponse'>;
  export type PropertyCreateRequest = Schema<'PropertyCreateRequest'>;
  export type PropertyCategoryResponse = Schema<'PropertyCategoryResponse'>;

  export type VendorResponse = Schema<'VendorResponse'>;
  export type VendorCreateRequest = Schema<'VendorCreateRequest'>;
  export type VendorUpdateRequest = Schema<'VendorUpdateRequest'>;
  export type VendorCategoryResponse = Schema<'VendorCategoryResponse'>;
  export type PaymentMethodResponse = Schema<'PaymentMethodResponse'>;
  ```

- [ ] **Step 5: Verify build**
  Run `npm --prefix frontend run build` to confirm clean compilation.

- [ ] **Step 6: Commit**
  Commit Task 1 changes.

---

### Task 2: Refactor `apiClient.ts` to `openapi-fetch`

**Files:**
- Modify: `frontend/src/app/services/apiClient.ts`

- [ ] **Step 1: Replace custom fetch wrapper with `createClient`**
  Rewrite `frontend/src/app/services/apiClient.ts` using `createClient<paths>` from `openapi-fetch`:
  ```typescript
  import createClient from 'openapi-fetch';
  import type { paths } from '@/types/api.generated';

  export const API_BASE_URL = 'http://localhost:8080';

  export const apiClient = createClient<paths>({
    baseUrl: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  ```

- [ ] **Step 2: Add optional error-handling or auth middleware if required**
  Configure request/response interceptors if needed for error logging or auth headers.

- [ ] **Step 3: Identify deprecated legacy methods**
  Remove legacy `request<T>()`, `apiClient.get()`, `apiClient.post()`, `apiClient.put()`, `apiClient.patch()`.

---

### Task 3: Migrate `propertyService.ts` and `propertyAdapter.ts` to Generated Types

**Files:**
- Modify: `frontend/src/app/services/propertyService.ts`
- Modify: `frontend/src/app/adapters/propertyAdapter.ts`

- [ ] **Step 1: Update `propertyService.ts` to use `openapi-fetch`**
  Rewrite endpoints using typed route strings:
  ```typescript
  import { apiClient } from './apiClient';
  import type { PropertyResponse, PropertyCreateRequest } from '@/types/api';
  import type { Property as UIProperty } from '@/types';
  import { toUIProperty, toBackendPropertyCreate, CreatePropertyInput } from '../adapters/propertyAdapter';

  export async function getProperties(): Promise<PropertyResponse[]> {
    const { data, error } = await apiClient.GET('/api/v1/properties');
    if (error) throw new Error('Failed to fetch properties');
    return data ?? [];
  }

  export async function getPropertyById(propertyId: string): Promise<PropertyResponse> {
    const { data, error } = await apiClient.GET('/api/v1/properties/{propertyId}', {
      params: { path: { propertyId } },
    });
    if (error || !data) throw new Error(`Property ${propertyId} not found`);
    return data;
  }

  export async function createProperty(request: PropertyCreateRequest): Promise<PropertyResponse> {
    const { data, error } = await apiClient.POST('/api/v1/properties', {
      body: request,
    });
    if (error || !data) throw new Error('Failed to create property');
    return data;
  }
  ```

- [ ] **Step 2: Update `propertyAdapter.ts` imports**
  Change imports from `../../types/property` to `@/types/api`:
  ```typescript
  import type { PropertyResponse, PropertyCreateRequest } from '@/types/api';
  ```

- [ ] **Step 3: Verify build**
  Run `npm --prefix frontend run build`.

- [ ] **Step 4: Commit**
  Commit Task 3 changes.

---

### Task 4: Migrate `vendorService.ts` and `vendorAdapter.ts` to Generated Types

**Files:**
- Modify: `frontend/src/app/services/vendorService.ts`
- Modify: `frontend/src/app/adapters/vendorAdapter.ts`

- [ ] **Step 1: Update `vendorService.ts` to use `openapi-fetch`**
  ```typescript
  import { apiClient } from './apiClient';
  import type { VendorResponse, VendorCreateRequest, VendorUpdateRequest } from '@/types/api';
  import type { Vendor as UIVendor } from '@/types';
  import { toUIVendor, toBackendVendorCreate, CreateVendorInput } from '../adapters/vendorAdapter';

  export async function getVendors(): Promise<VendorResponse[]> {
    const { data, error } = await apiClient.GET('/api/v1/vendors');
    if (error) throw new Error('Failed to fetch vendors');
    return data ?? [];
  }

  export async function getVendorByUuid(vendorUuid: string): Promise<VendorResponse> {
    const { data, error } = await apiClient.GET('/api/v1/vendors/{vendorUuid}', {
      params: { path: { vendorUuid } },
    });
    if (error || !data) throw new Error(`Vendor ${vendorUuid} not found`);
    return data;
  }

  export async function createVendor(request: VendorCreateRequest): Promise<VendorResponse> {
    const { data, error } = await apiClient.POST('/api/v1/vendors', {
      body: request,
    });
    if (error || !data) throw new Error('Failed to create vendor');
    return data;
  }

  export async function updateVendor(vendorUuid: string, request: VendorUpdateRequest): Promise<VendorResponse> {
    const { data, error } = await apiClient.PUT('/api/v1/vendors/{vendorUuid}', {
      params: { path: { vendorUuid } },
      body: request,
    });
    if (error || !data) throw new Error('Failed to update vendor');
    return data;
  }
  ```

- [ ] **Step 2: Update `vendorAdapter.ts` imports**
  Change imports from `../../types/vendor` to `@/types/api`:
  ```typescript
  import type { VendorResponse, VendorCreateRequest } from '@/types/api';
  ```

- [ ] **Step 3: Verify build**
  Run `npm --prefix frontend run build`.

- [ ] **Step 4: Commit**
  Commit Task 4 changes.

---

### Task 5: Migrate `metadataService.ts`, Context, and Master Data Hook

**Files:**
- Modify: `frontend/src/app/services/metadataService.ts`
- Modify: `frontend/src/context/InvoiceContext.tsx`
- Modify: `frontend/src/hooks/useMasterData.ts`

- [ ] **Step 1: Update `metadataService.ts` to use `openapi-fetch`**
  ```typescript
  import { apiClient } from './apiClient';
  import type {
    PropertyCategoryResponse,
    VendorCategoryResponse,
    PaymentMethodResponse,
  } from '@/types/api';

  export async function fetchPropertyCategories(): Promise<PropertyCategoryResponse[]> {
    const { data, error } = await apiClient.GET('/api/v1/properties/categories');
    return (!error && Array.isArray(data)) ? data : [];
  }

  export async function fetchVendorCategories(): Promise<VendorCategoryResponse[]> {
    const { data, error } = await apiClient.GET('/api/v1/vendors/categories');
    return (!error && Array.isArray(data)) ? data : [];
  }

  export async function fetchPaymentMethods(): Promise<PaymentMethodResponse[]> {
    const { data, error } = await apiClient.GET('/api/v1/vendors/payment-methods');
    return (!error && Array.isArray(data)) ? data : [];
  }
  ```

- [ ] **Step 2: Update `InvoiceContext.tsx` and `useMasterData.ts` imports**
  Update imports from `../types/metadata` to `@/types/api`:
  ```typescript
  import type { PropertyCategoryResponse, VendorCategoryResponse, PaymentMethodResponse } from '@/types/api';
  ```

- [ ] **Step 3: Verify build**
  Run `npm --prefix frontend run build`.

- [ ] **Step 4: Commit**
  Commit Task 5 changes.

---

### Task 6: Delete Deprecated Hand-Written DTO Files and Final Verification

**Files:**
- Delete: `frontend/src/types/property.ts`
- Delete: `frontend/src/types/vendor.ts`
- Delete: `frontend/src/types/metadata.ts`
- Update any lingering references in `frontend/src/types/propertyvendormapping.ts` and `user.ts`

- [ ] **Step 1: Check for remaining references to deprecated type files**
  Run `git grep -E "types/(property|vendor|metadata)" frontend/src` and ensure any imports are updated to `@/types/api` or `@/types` (for UI models).

- [ ] **Step 2: Delete deprecated DTO files**
  Delete `frontend/src/types/property.ts`, `frontend/src/types/vendor.ts`, and `frontend/src/types/metadata.ts`.

- [ ] **Step 3: Run full verification build**
  Run `npm --prefix frontend run build` to confirm 0 TypeScript errors.

- [ ] **Step 4: Final commit**
  Commit the migration and cleanup.

