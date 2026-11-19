import { useEffect, useMemo } from "react";
import type { ResourceListState } from "@/app/hooks/useResourceList";
import { useVendorStore } from "@/stores";
import type { VendorResponse } from "@/types/vendor";

export type VendorsState = ResourceListState<VendorResponse>;

export function useVendors() {
  const vendors = useVendorStore((s) => s.vendors);
  const hasLoaded = useVendorStore((s) => s.hasLoaded);
  const error = useVendorStore((s) => s.error);
  const fetchVendors = useVendorStore((s) => s.fetchVendors);
  const addVendor = useVendorStore((s) => s.addVendor);
  const replaceVendor = useVendorStore((s) => s.replaceVendor);
  const removeVendor = useVendorStore((s) => s.removeVendor);

  useEffect(() => {
    void fetchVendors();
  }, [fetchVendors]);

  // Based on hasLoaded, not isLoading, so a save doesn't flip the list back to "loading"
  const state = useMemo<VendorsState>(
    () =>
      hasLoaded
        ? { status: "loaded", items: vendors }
        : error
          ? { status: "error", message: error }
          : { status: "loading" },
    [hasLoaded, error, vendors],
  );

  return { state, addVendor, replaceVendor, removeVendor };
}