import { useEffect } from "react";
import { useInvoiceStore } from "../stores/useInvoiceStore";

export function InvoiceList() {
  // Best practice: Pick atomic state slices via selector functions to avoid unnecessary re-renders
  const invoices = useInvoiceStore((state) => state.invoices);
  const isLoading = useInvoiceStore((state) => state.isLoading);
  const error = useInvoiceStore((state) => state.error);
  const selectedInvoice = useInvoiceStore((state) => state.selectedInvoice);

  const fetchInvoices = useInvoiceStore((state) => state.fetchInvoices);
  const selectInvoice = useInvoiceStore((state) => state.selectInvoice);
  const clearError = useInvoiceStore((state) => state.clearError);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return (
    <section className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-gray-500">
            Managed via Zustand store connected to Spring Boot REST endpoints.
          </p>
        </div>
        <button
          onClick={() => fetchInvoices()}
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

      {isLoading && invoices.length === 0 && (
        <div className="py-8 text-center text-gray-500">Loading invoices...</div>
      )}

      {!isLoading && !error && invoices.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
          No invoices found.
        </div>
      )}

      {invoices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 overflow-hidden rounded-lg border border-gray-200 shadow-sm bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left font-medium text-gray-600">
                <tr>
                  <th className="px-4 py-3">Vendor Invoice ID</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr
                    key={inv.invoiceId}
                    className={`hover:bg-gray-50 transition-colors ${
                      selectedInvoice?.invoiceId === inv.invoiceId ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {inv.vendorSuppliedInvoiceId || inv.invoiceId.substring(0, 8)}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">
                      ${inv.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inv.dueDate}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">
                        {inv.invoiceStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => selectInvoice(inv)}
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
            <h2 className="text-lg font-semibold mb-3">Selected Invoice</h2>
            {selectedInvoice ? (
              <div className="space-y-2 text-sm text-gray-700">
                <div>
                  <span className="font-medium text-gray-500 block">UUID:</span>
                  <span className="font-mono text-xs break-all">{selectedInvoice.invoiceId}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 block">Vendor Invoice #:</span>
                  <span>{selectedInvoice.vendorSuppliedInvoiceId}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 block">Amount:</span>
                  <span className="font-semibold">${selectedInvoice.amount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 block">Billing Period:</span>
                  <span>
                    {selectedInvoice.billingPeriodStart} to {selectedInvoice.billingPeriodEnd}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 block">Status:</span>
                  <span>{selectedInvoice.invoiceStatus}</span>
                </div>
                {selectedInvoice.failureReason && (
                  <div className="text-red-600">
                    <span className="font-medium block">Failure Reason:</span>
                    <span>{selectedInvoice.failureReason}</span>
                  </div>
                )}
                <div className="pt-2">
                  <button
                    onClick={() => selectInvoice(null)}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Clear selection
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Select an invoice to view full details.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default InvoiceList;

