import { useEffect, useMemo } from "react";
import type { ResourceListState } from "@/app/hooks/useResourceList";
import { usePropertyStore } from "@/stores";
import type { PropertyResponse } from "@/types/property";

export type PropertiesState = ResourceListState<PropertyResponse>;

// Same shape as before, so PropertiesPage and DashboardPage don't change
export function useProperties() {
  const properties = usePropertyStore((s) => s.properties);
  const hasLoaded = usePropertyStore((s) => s.hasLoaded);
  const error = usePropertyStore((s) => s.error);
  const fetchProperties = usePropertyStore((s) => s.fetchProperties);
  const addProperty = usePropertyStore((s) => s.addProperty);
  const replaceProperty = usePropertyStore((s) => s.replaceProperty);
  const removeProperty = usePropertyStore((s) => s.removeProperty);

  useEffect(() => {
    void fetchProperties();
  }, [fetchProperties]);

  // Based on hasLoaded, not isLoading, so a save doesn't flip the list back to "loading".
  // Memoized so components can use it as a dependency.
  const state = useMemo<PropertiesState>(
    () =>
      hasLoaded
        ? { status: "loaded", items: properties }
        : error
          ? { status: "error", message: error }
          : { status: "loading" },
    [hasLoaded, error, properties],
  );

  return { state, addProperty, replaceProperty, removeProperty };
}