import { useEffect } from "react";
import { useVendorStore } from "../stores/useVendorStore";

export function VendorList() {
  const vendors = useVendorStore((state) => state.vendors);
  const isLoading = useVendorStore((state) => state.isLoading);
  const error = useVendorStore((state) => state.error);
  const selectedVendor = useVendorStore((state) => state.selectedVendor);

  const fetchVendors = useVendorStore((state) => state.fetchVendors);
  const selectVendor = useVendorStore((state) => state.selectVendor);
  const clearError = useVendorStore((state) => state.clearError);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  return (
    <section className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendors</h1>
          <p className="text-sm text-gray-500">
            Managed via Zustand store connected to Spring Boot REST endpoints.
          </p>
        </div>
        <button
          onClick={() => fetchVendors()}
          disabled={isLoading}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
        >
          <span>{error}</span>
          <button
            onClick={clearError}
            className="font-semibold underline hover:text-red-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {isLoading && vendors.length === 0 && (
        <div className="py-8 text-center text-gray-500">Loading vendors...</div>
      )}

      {!isLoading && !error && vendors.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
          No vendors found.
        </div>
      )}

      {vendors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 overflow-hidden rounded-lg border border-gray-200 shadow-sm bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left font-medium text-gray-600">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendors.map((vendor) => (
                  <tr
                    key={vendor.vendorUuid}
                    className={`hover:bg-gray-50 transition-colors ${
                      selectedVendor?.vendorUuid === vendor.vendorUuid
                        ? "bg-blue-50/50"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {vendor.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {vendor.phoneNumber && vendor.phoneNumber !== "NULL"
                        ? vendor.phoneNumber
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {vendor.paymentMethod}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          vendor.status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {vendor.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => selectVendor(vendor)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Details Panel */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Selected Vendor</h2>
            {selectedVendor ? (
              <div className="space-y-2 text-sm text-gray-700">
                <div>
                  <span className="font-medium text-gray-500 block">UUID:</span>
                  <span className="font-mono text-xs break-all">
                    {selectedVendor.vendorUuid}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 block">Name:</span>
                  <span className="font-semibold">{selectedVendor.name}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 block">Phone:</span>
                  <span>{selectedVendor.phoneNumber ?? "—"}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 block">Status:</span>
                  <span>{selectedVendor.status}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 block">
                    Payment Method:
                  </span>
                  <span>{selectedVendor.paymentMethod}</span>
                </div>
                {selectedVendor.paymentUrl && (
                  <div>
                    <span className="font-medium text-gray-500 block">
                      Payment URL:
                    </span>
                    <a
                      href={selectedVendor.paymentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {selectedVendor.paymentUrl}
                    </a>
                  </div>
                )}
                <div className="pt-2">
                  <button
                    onClick={() => selectVendor(null)}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Clear selection
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                Select a vendor to view full details.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default VendorList;

