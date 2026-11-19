import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { PropertyCreateRequest, PropertyResponse } from "@/types/property";
import { createProperty, getProperties, getPropertyById } from "@/features/properties/propertyService";

export interface PropertyState {
  properties: PropertyResponse[];
  selectedProperty: PropertyResponse | null;
  // True after the first successful load; the list is shared by every page that uses it
  hasLoaded: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProperties: (options?: { force?: boolean }) => Promise<void>;
  fetchPropertyByUuid: (uuid: string) => Promise<void>;
  createProperty: (data: PropertyCreateRequest) => Promise<PropertyResponse>;
  // Local-only: the form modals already call the API, so these just sync the list
  addProperty: (property: PropertyResponse) => void;
  replaceProperty: (property: PropertyResponse) => void;
  removeProperty: (property: PropertyResponse) => void;
  selectProperty: (property: PropertyResponse | null) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  properties: [],
  selectedProperty: null,
  hasLoaded: false,
  isLoading: false,
  error: null,
};

export const usePropertyStore = create<PropertyState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      fetchProperties: async (options) => {
        // Skip if already loaded or a load is in flight (also covers StrictMode's double effect)
        if (get().isLoading || (get().hasLoaded && !options?.force)) return;
        set({ isLoading: true, error: null }, false, "property/fetchProperties/pending");
        try {
          const properties = await getProperties();
          set({ properties, hasLoaded: true, isLoading: false }, false, "property/fetchProperties/fulfilled");
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to load properties";
          set({ error: message, isLoading: false }, false, "property/fetchProperties/rejected");
        }
      },

      fetchPropertyByUuid: async (uuid: string) => {
        set({ isLoading: true, error: null }, false, "property/fetchPropertyByUuid/pending");
        try {
          const property = await getPropertyById(uuid);
          set({ selectedProperty: property, isLoading: false }, false, "property/fetchPropertyByUuid/fulfilled");
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : `Failed to load property ${uuid}`;
          set({ error: message, isLoading: false }, false, "property/fetchPropertyByUuid/rejected");
        }
      },

      createProperty: async (data: PropertyCreateRequest) => {
        set({ isLoading: true, error: null }, false, "property/createProperty/pending");
        try {
          const created = await createProperty(data);
          set(
            (state) => ({ properties: [...state.properties, created], isLoading: false }),
            false,
            "property/createProperty/fulfilled",
          );
          return created;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to create property";
          set({ error: message, isLoading: false }, false, "property/createProperty/rejected");
          throw err;
        }
      },

      addProperty: (property) => {
        set((state) => ({ properties: [...state.properties, property] }), false, "property/addProperty");
      },

      replaceProperty: (property) => {
        set(
          (state) => ({
            properties: state.properties.map((p) => (p.propertyId === property.propertyId ? property : p)),
            selectedProperty:
              state.selectedProperty?.propertyId === property.propertyId ? property : state.selectedProperty,
          }),
          false,
          "property/replaceProperty",
        );
      },

      removeProperty: (property) => {
        set(
          (state) => ({
            properties: state.properties.filter((p) => p.propertyId !== property.propertyId),
            selectedProperty:
              state.selectedProperty?.propertyId === property.propertyId ? null : state.selectedProperty,
          }),
          false,
          "property/removeProperty",
        );
      },

      selectProperty: (property) => {
        set({ selectedProperty: property }, false, "property/selectProperty");
      },

      clearError: () => {
        set({ error: null }, false, "property/clearError");
      },

      reset: () => {
        set(initialState, false, "property/reset");
      },
    }),
    { name: "PropertyStore" },
  ),
);