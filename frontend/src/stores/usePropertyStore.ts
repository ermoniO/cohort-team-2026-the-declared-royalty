import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
    PropertyCreateRequest,
    PropertyResponse
} from "@/types/property";
import { getProperties, getPropertyById, createProperty } from "@/app/services/propertyService"

export interface PropertyState {
    properties: PropertyResponse[];
    selectedProperty: PropertyResponse | null;
    isLoading: boolean;
    error: string | null;

    //Actions
    fetchProperties: () => Promise<void>;
    fetchPropertyByUuid: (uuid: string) => Promise<void>;
    createProperty: (data: PropertyCreateRequest) => Promise<PropertyResponse>;
    selectProperty: (vendor: PropertyResponse | null) => void;
    clearError: () => void;
    reset: () => void;
};

const initialState = {
    properties: [],
    selectedProperty: null,
    isLoading: false,
    error: null,
};

export const usePropertyStore = create<PropertyState>()(
    devtools(
        (set) => ({
            ...initialState,

            fetchProperties: async () => {
                set({ isLoading: true, error: null }, false, "property/fetchProperties/pending");
                try {
                    const properties = await getProperties();
                    set(
                        { properties, isLoading: false },
                        false,
                        "properties/fetchProperties/fulfilled"
                    );
                } catch (err: unknown) {
                    const message =
                        err instanceof Error ? err.message : "Failed to load properties";
                    set({ error: message, isLoading: false }, false, "property/fetchProperties/rejected");
                }
            },

            fetchPropertyByUuid: async (uuid: string) => {
                set({ isLoading: true, error: null }, false, "property/fetchPropertyByUuid/pending");
                try {
                    const property = await getPropertyById(uuid);
                    set(
                        { selectedProperty: property, isLoading: false },
                        false,
                        "property/fetchPropertyByUuid/fulfilled"
                    );
                } catch (err: unknown) {
                    const message =
                        err instanceof Error ? err.message : `failed to load property ${uuid}`;
                    set({ error: message, isLoading: false }, false, "property/fetchPropertyByUuid/rejected");
                }
            },

            createProperty: async (data: PropertyCreateRequest) => {
                set({ isLoading: true, error: null }, false, "property/createProperty/pending");
                try {
                    const created = await createProperty(data);
                    set(
                        (state) => ({
                            properties: [created, ...state.properties],
                            isLoading: false,
                        }),
                        false,
                        "property/createProperty/fulfilled"
                    );
                    return created;
                } catch (err: unknown) {
                    const message =
                        err instanceof Error ? err.message : "Failed to create property";
                    set({ error: message, isLoading: false }, false, "property/createProperty/rejected");
                    throw err;
                }
            },

            selectProperty: (property) => {
                set({ selectedProperty: property }, false, "property/selectProperty");
            },

            clearError: () => {
                set({ error: null }, false, "property/clearProperty");
            },

            reset: () => {
                set(initialState, false, "property/reset");
            },
        }),
        { name: "PropertyStore" }
    )
);