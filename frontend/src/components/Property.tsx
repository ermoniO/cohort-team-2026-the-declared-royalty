import { useEffect, useState } from "react";
import { apiClient } from "../app/services/apiClient";
import type { PropertyResponse } from "../types/property";

interface PropertyProps {
  refreshTrigger?: number;
}

function Property({ refreshTrigger }: PropertyProps) {
  const [properties, setProperties] = useState<PropertyResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    apiClient
      .get<PropertyResponse[]>("/api/v1/properties", undefined, false)
      .then((data) => {
        if (active) {
          setProperties(data || []);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Failed to load properties."
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshTrigger]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Live Properties Data Table</h2>
          <p className="text-xs text-gray-500">
            Current records stored in PostgreSQL database (auto-refreshed upon test runs)
          </p>
        </div>
        <span className="text-xs bg-slate-200 text-slate-700 font-medium px-2.5 py-0.5 rounded-full">
          Total: {properties.length}
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-8">
          <p className="text-gray-500 text-xs animate-pulse">Loading live properties...</p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="m-4 p-3 rounded-md bg-red-50 text-red-700 border border-red-200 text-xs"
        >
          <p className="font-semibold">Could not load properties from backend:</p>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && properties.length === 0 && (
        <div className="text-center py-10 border-2 border-dashed border-gray-200 m-4 rounded-lg">
          <p className="text-gray-400 text-xs">No properties in table. Click "⚡ Hydrate" or run POST to create some.</p>
        </div>
      )}

      {!loading && !error && properties.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="py-3 pl-4 pr-3 text-left font-semibold text-gray-900 sm:pl-6"
                >
                  Property Name
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left font-semibold text-gray-900"
                >
                  Address
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left font-semibold text-gray-900"
                >
                  City, State, Zip
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left font-semibold text-gray-900"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left font-semibold text-gray-900"
                >
                  Property ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {properties.map((property) => (
                <tr key={property.propertyId} className="hover:bg-gray-50/80">
                  <td className="whitespace-nowrap py-3 pl-4 pr-3 font-medium text-gray-900 sm:pl-6">
                    {property.name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                    {property.streetAddress}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                    {property.city}, {property.state} {property.zipCode}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 text-[10px] font-semibold leading-4 ${
                        property.status?.toUpperCase() === "ACTIVE"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {property.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-gray-400">
                    {property.propertyId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Property;
