import { useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { TbArrowRight, TbBuilding, TbBuildingStore } from "react-icons/tb";
import { navigateTo } from "@/app/navigation";
import { useAuditHistory } from "@/features/auditLogs/useAuditHistory";
import NeedsAttentionCard from "@/features/dashboard/NeedsAttentionCard";
import RecentActivityCard from "@/features/dashboard/RecentActivityCard";
import InvoiceSummaryCards from "@/features/invoices/InvoiceSummaryCards";
import ReviewInvoiceModal from "@/features/invoices/ReviewInvoiceModal";
import UploadInvoicesModal from "@/features/invoices/UploadInvoicesModal";
import { useInvoicePage, useInvoiceSummary } from "@/features/invoices/useInvoices";
import PaymentsSummaryCards from "@/features/payments/PaymentsSummaryCards";
import { usePaymentSummary } from "@/features/payments/usePaymentSummary";
import PropertyFormModal from "@/features/properties/PropertyFormModal";
import { useProperties } from "@/features/properties/useProperties";
import VendorFormModal from "@/features/vendors/VendorFormModal";
import { useVendors } from "@/features/vendors/useVendors";
import { useAuditLogStore } from "@/stores";
import type { InvoiceResponse } from "@/types/invoice";

export default function DashboardPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [reviewing, setReviewing] = useState<InvoiceResponse | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Row 1: Invoice Pipeline KPIs
  const invoiceSummary = useInvoiceSummary(reloadKey);

  // Row 2: Payments Snapshot & Directory Counts
  const paymentSummary = usePaymentSummary(reloadKey);
  const { state: propertiesState, addProperty } = useProperties();
  const { state: vendorsState, addVendor } = useVendors();

  // Row 3: Needs Attention Queue & Recent Audit Activity
  const attentionInvoices = useInvoicePage(0, 5, ["PENDING_MAPPING", "FAILED"], "", reloadKey);
  const fetchHistory = useAuditLogStore((s) => s.fetchHistory);
  const auditLoading = useAuditLogStore((s) => s.isLoading);
  const auditError = useAuditLogStore((s) => s.error);
  const { logs, actorName, invoiceLabel } = useAuditHistory();

  useEffect(() => {
    void fetchHistory(null);
  }, [fetchHistory, reloadKey]);

  const refreshDashboard = () => setReloadKey((key) => key + 1);

  const propertyCount =
    propertiesState.status === "loaded" ? propertiesState.items.length.toLocaleString("en-US") : "—";
  const vendorCount =
    vendorsState.status === "loaded" ? vendorsState.items.length.toLocaleString("en-US") : "—";

  return (
    <div className="flex flex-col gap-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-inter-regular text-sm text-[#68766f]">
          Overview of incoming bills, payment pipeline, and recent activity.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="font-inter-medium flex h-9 items-center gap-1.5 rounded-[7px] border border-[#e6ebe8] bg-white px-3 text-sm text-[#25362f] hover:bg-[#f8faf9]"
            onClick={() => setPropertyModalOpen(true)}
            type="button"
          >
            <TbBuilding size={15} />
            Add property
          </button>
          <button
            className="font-inter-medium flex h-9 items-center gap-1.5 rounded-[7px] border border-[#e6ebe8] bg-white px-3 text-sm text-[#25362f] hover:bg-[#f8faf9]"
            onClick={() => setVendorModalOpen(true)}
            type="button"
          >
            <TbBuildingStore size={15} />
            Add vendor
          </button>
          <button
            className="font-inter-semibold flex h-9 items-center gap-2 rounded-[7px] bg-[#16834a] px-4 text-sm text-white hover:bg-[#13723f]"
            onClick={() => setUploadOpen(true)}
            type="button"
          >
            <FiPlus size={16} />
            Add invoice
          </button>
        </div>
      </div>

      {/* Row 1: Invoice Pipeline KPIs */}
      <section
        aria-label="Invoice pipeline summary"
        className="flex flex-col gap-3 rounded-2xl border border-[#e6ebe8] bg-[#f1f5f3] p-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-inter-semibold text-sm text-[#14532d]">Invoice pipeline</h2>
          <button
            className="font-inter-medium flex items-center gap-1 text-xs text-[#16834a] hover:underline"
            onClick={() => navigateTo("/bills")}
            type="button"
          >
            Open Bills
            <TbArrowRight size={14} />
          </button>
        </div>
        <InvoiceSummaryCards state={invoiceSummary} />
      </section>

      {/* Row 2: Payments Snapshot + Directory Footprint */}
      <section aria-label="Payments and directory summary" className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-[#e6ebe8] bg-[#f1f5f3] p-4 xl:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-inter-semibold text-sm text-[#14532d]">Payments snapshot</h2>
            <button
              className="font-inter-medium flex items-center gap-1 text-xs text-[#16834a] hover:underline"
              onClick={() => navigateTo("/payments")}
              type="button"
            >
              View payment queue
              <TbArrowRight size={14} />
            </button>
          </div>
          <PaymentsSummaryCards compact state={paymentSummary} />
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-[#e6ebe8] bg-[#f1f5f3] p-4">
          <h2 className="font-inter-semibold text-sm text-[#14532d]">Directory</h2>
          <div className="flex flex-1 flex-col justify-between gap-3 rounded-xl border border-[#e6ebe8] bg-white px-5 py-4">
            <button
              className="flex items-center justify-between text-left hover:opacity-80"
              onClick={() => navigateTo("/properties")}
              type="button"
            >
              <span className="flex items-center gap-2 text-sm text-[#25362f]">
                <TbBuilding className="text-[#16834a]" size={16} />
                Properties
              </span>
              <span className="font-inter-semibold text-lg text-[#14532d]">{propertyCount}</span>
            </button>
            <div className="h-px bg-[#e6ebe8]" />
            <button
              className="flex items-center justify-between text-left hover:opacity-80"
              onClick={() => navigateTo("/vendors")}
              type="button"
            >
              <span className="flex items-center gap-2 text-sm text-[#25362f]">
                <TbBuildingStore className="text-[#16834a]" size={16} />
                Vendors
              </span>
              <span className="font-inter-semibold text-lg text-[#14532d]">{vendorCount}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Row 3: Action Queue + Recent Audit Activity */}
      <section aria-label="Action queue and recent activity" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <NeedsAttentionCard onSelectInvoice={setReviewing} state={attentionInvoices} />
        <RecentActivityCard
          actorName={actorName}
          error={auditError}
          invoiceLabel={invoiceLabel}
          isLoading={auditLoading}
          logs={logs}
        />
      </section>

      {uploadOpen && (
        <UploadInvoicesModal
          onClose={() => setUploadOpen(false)}
          onUploaded={refreshDashboard}
        />
      )}

      {propertyModalOpen && (
        <PropertyFormModal
          existing={propertiesState.status === "loaded" ? propertiesState.items : []}
          mode={{ kind: "create" }}
          onClose={() => setPropertyModalOpen(false)}
          onDeleted={() => { }}
          onSaved={(property) => {
            addProperty(property);
            setPropertyModalOpen(false);
          }}
        />
      )}

      {vendorModalOpen && (
        <VendorFormModal
          existing={vendorsState.status === "loaded" ? vendorsState.items : []}
          mode={{ kind: "create" }}
          onClose={() => setVendorModalOpen(false)}
          onDeleted={() => { }}
          onSaved={(vendor) => {
            addVendor(vendor);
            setVendorModalOpen(false);
          }}
        />
      )}

      {reviewing && (
        <ReviewInvoiceModal
          invoice={reviewing}
          key={reviewing.invoiceUuid}
          onClose={() => {
            setReviewing(null);
            refreshDashboard();
          }}
        />
      )}
    </div>
  );
}
