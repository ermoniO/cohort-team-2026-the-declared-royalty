import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PropertyResponse } from "@/types/property";
import type { UserResponse } from "@/types/user";
import type { VendorResponse } from "@/types/vendor";

vi.mock("@/features/vendors/vendorService", () => ({
  vendorService: { getAll: vi.fn(), getByUuid: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock("@/features/properties/propertyService", () => ({
  getProperties: vi.fn(),
  getPropertyById: vi.fn(),
  createProperty: vi.fn(),
}));
vi.mock("@/features/users/useCurrentUser", () => ({
  loadCurrentUser: vi.fn(),
  storeUserId: vi.fn(),
}));

import { vendorService } from "@/features/vendors/vendorService";
import { getProperties } from "@/features/properties/propertyService";
import { loadCurrentUser, storeUserId } from "@/features/users/useCurrentUser";
import { usePropertyStore, useUserStore, useVendorStore } from "@/stores";

const vendor = (id: string, name = `Vendor ${id}`) =>
  ({ vendorUuid: id, name, status: "ACTIVE", paymentMethod: "ACH", createdAt: "", updatedAt: "" }) as VendorResponse;
const property = (id: string, name = `Property ${id}`) =>
  ({ propertyId: id, name, streetAddress: "1 Main St", city: "Dallas", state: "TX", zipCode: "75001" }) as PropertyResponse;
const user = (id: string) => ({ userId: id, username: `User ${id}`, status: "ACTIVE", createdAt: "", updatedAt: "" }) as UserResponse;

beforeEach(() => {
  vi.clearAllMocks();
  useVendorStore.setState({ vendors: [], hasLoaded: false, isLoading: false, error: null });
  usePropertyStore.setState({ properties: [], hasLoaded: false, isLoading: false, error: null, selectedProperty: null });
  useUserStore.setState({ currentUser: null, currentUserLoading: true, currentUserError: null });
});

describe("useVendorStore", () => {
  it("loads once, even when two pages ask at the same time", async () => {
    vi.mocked(vendorService.getAll).mockResolvedValue([vendor("a")]);

    await Promise.all([useVendorStore.getState().fetchVendors(), useVendorStore.getState().fetchVendors()]);
    await useVendorStore.getState().fetchVendors();

    expect(vendorService.getAll).toHaveBeenCalledTimes(1);
    expect(useVendorStore.getState().hasLoaded).toBe(true);
  });

  it("reloads when forced", async () => {
    vi.mocked(vendorService.getAll).mockResolvedValue([vendor("a")]);
    await useVendorStore.getState().fetchVendors();
    await useVendorStore.getState().fetchVendors({ force: true });

    expect(vendorService.getAll).toHaveBeenCalledTimes(2);
  });

  it("adds, replaces and removes without refetching", () => {
    const { addVendor, replaceVendor, removeVendor } = useVendorStore.getState();
    addVendor(vendor("a"));
    addVendor(vendor("b"));
    replaceVendor(vendor("a", "Renamed"));
    removeVendor(vendor("b"));

    expect(useVendorStore.getState().vendors).toEqual([vendor("a", "Renamed")]);
    expect(vendorService.getAll).not.toHaveBeenCalled();
  });

  it("keeps hasLoaded false and records the error when loading fails", async () => {
    vi.mocked(vendorService.getAll).mockRejectedValue(new Error("boom"));
    await useVendorStore.getState().fetchVendors();

    expect(useVendorStore.getState()).toMatchObject({ hasLoaded: false, isLoading: false, error: "boom" });
  });
});

describe("usePropertyStore", () => {
  it("loads once", async () => {
    vi.mocked(getProperties).mockResolvedValue([property("p1")]);
    await usePropertyStore.getState().fetchProperties();
    await usePropertyStore.getState().fetchProperties();

    expect(getProperties).toHaveBeenCalledTimes(1);
    expect(usePropertyStore.getState().properties).toEqual([property("p1")]);
  });

  it("replaces and removes by propertyId, keeping the selection in step", () => {
    const store = usePropertyStore.getState();
    store.addProperty(property("p1"));
    store.addProperty(property("p2"));
    store.selectProperty(property("p1"));

    store.replaceProperty(property("p1", "Renamed"));
    expect(usePropertyStore.getState().selectedProperty?.name).toBe("Renamed");

    store.removeProperty(property("p1"));
    expect(usePropertyStore.getState().properties.map((p) => p.propertyId)).toEqual(["p2"]);
    expect(usePropertyStore.getState().selectedProperty).toBeNull();
  });
});

describe("useUserStore current user", () => {
  it("loads the current user once, even with StrictMode's double effect", async () => {
    vi.mocked(loadCurrentUser).mockResolvedValue(user("me"));

    await Promise.all([useUserStore.getState().loadCurrentUser(), useUserStore.getState().loadCurrentUser()]);
    await useUserStore.getState().loadCurrentUser();

    expect(loadCurrentUser).toHaveBeenCalledTimes(1);
    expect(useUserStore.getState()).toMatchObject({ currentUser: user("me"), currentUserLoading: false });
  });

  it("records the error when the current user can't be loaded", async () => {
    vi.mocked(loadCurrentUser).mockRejectedValue(new Error("404"));
    await useUserStore.getState().loadCurrentUser();

    expect(useUserStore.getState()).toMatchObject({ currentUser: null, currentUserLoading: false, currentUserError: "404" });
  });

  it("switchUser saves the choice and updates the current user", () => {
    useUserStore.getState().switchUser(user("other"));

    expect(storeUserId).toHaveBeenCalledWith("other");
    expect(useUserStore.getState().currentUser?.userId).toBe("other");
  });
});