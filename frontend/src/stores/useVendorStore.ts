import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  Vendor,
  VendorCreateRequest,
  VendorUpdateRequest,
} from "@/types/vendor";
import { vendorService } from "@/features/vendors/vendorService";

/**
 * State and Action interfaces for Vendor Management
 */
export interface VendorState {
  vendors: Vendor[];
  selectedVendor: Vendor | null;
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
  

  // Actions
  fetchVendors: (options?: { force?: boolean }) => Promise<void>;
  // Local-only: the form modals already call the API, so these just sync the list
  addVendor: (vendor: Vendor) => void;
  replaceVendor: (vendor: Vendor) => void;
  removeVendor: (vendor: Vendor) => void;
  fetchVendorByUuid: (uuid: string) => Promise<void>;
  createVendor: (data: VendorCreateRequest) => Promise<Vendor>;
  updateVendor: (uuid: string, updates: VendorUpdateRequest) => Promise<Vendor>;
  selectVendor: (vendor: Vendor | null) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  vendors: [],
  selectedVendor: null,
  isLoading: false,
  error: null,
  hasLoaded: false,
};

export const useVendorStore = create<VendorState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      fetchVendors: async (options) => {
        // Shared across pages: skip if already loaded or a load is in flight (also covers StrictMode)
        if (get().isLoading || (get().hasLoaded && !options?.force)) return;
        set({ isLoading: true, error: null }, false, "vendor/fetchVendors/pending");
        try {
          const vendors = await vendorService.getAll();
          set({ vendors, hasLoaded: true, isLoading: false }, false, "vendor/fetchVendors/fulfilled");
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to load vendors";
          set({ error: message, isLoading: false }, false, "vendor/fetchVendors/rejected");
        }
      },

      fetchVendorByUuid: async (uuid: string) => {
        set({ isLoading: true, error: null }, false, "vendor/fetchVendorByUuid/pending");
        try {
          const vendor = await vendorService.getByUuid(uuid);
          set(
            { selectedVendor: vendor, isLoading: false },
            false,
            "vendor/fetchVendorByUuid/fulfilled"
          );
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : `Failed to load vendor ${uuid}`;
          set({ error: message, isLoading: false }, false, "vendor/fetchVendorByUuid/rejected");
        }
      },

      createVendor: async (data: VendorCreateRequest) => {
        set({ isLoading: true, error: null }, false, "vendor/createVendor/pending");
        try {
          const created = await vendorService.create(data);
          set(
            (state) => ({
              vendors: [created, ...state.vendors],
              isLoading: false,
            }),
            false,
            "vendor/createVendor/fulfilled"
          );
          return created;
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Failed to create vendor";
          set({ error: message, isLoading: false }, false, "vendor/createVendor/rejected");
          throw err;
        }
      },

      updateVendor: async (uuid: string, updates: VendorUpdateRequest) => {
        set({ isLoading: true, error: null }, false, "vendor/updateVendor/pending");
        try {
          const updated = await vendorService.update(uuid, updates);
          set(
            (state) => ({
              vendors: state.vendors.map((v) =>
                v.vendorUuid === uuid ? updated : v
              ),
              selectedVendor:
                state.selectedVendor?.vendorUuid === uuid
                  ? updated
                  : state.selectedVendor,
              isLoading: false,
            }),
            false,
            "vendor/updateVendor/fulfilled"
          );
          return updated;
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : `Failed to update vendor ${uuid}`;
          set({ error: message, isLoading: false }, false, "vendor/updateVendor/rejected");
          throw err;
        }
      },

      selectVendor: (vendor) => {
        set({ selectedVendor: vendor }, false, "vendor/selectVendor");
      },

            addVendor: (vendor) => {
        set((state) => ({ vendors: [...state.vendors, vendor] }), false, "vendor/addVendor");
      },

      replaceVendor: (vendor) => {
        set(
          (state) => ({
            vendors: state.vendors.map((v) => (v.vendorUuid === vendor.vendorUuid ? vendor : v)),
          }),
          false,
          "vendor/replaceVendor",
        );
      },

      removeVendor: (vendor) => {
        set(
          (state) => ({ vendors: state.vendors.filter((v) => v.vendorUuid !== vendor.vendorUuid) }),
          false,
          "vendor/removeVendor",
        );
      },
      
      clearError: () => {
        set({ error: null }, false, "vendor/clearError");
      },

      reset: () => {
        set(initialState, false, "vendor/reset");
      },
    }),
    { name: "VendorStore" }
  )
);

