import React, { useState } from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Check,
  Edit3,
  Layers,
  ArrowRight,
  FileText,
  AlertCircle,
  Eye,
  Sliders,
  DollarSign
} from 'lucide-react';

export const BillIntakeExtraction: React.FC = () => {
  const {
    invoices,
    selectedInvoice,
    selectedInvoiceId,
    setSelectedInvoiceId,
    rerunExtraction,
    updateExtractedInvoice,
    confirmMatch,
    setActiveTab,
    currentProfile
  } = useInvoiceStore();

  const [zoomLevel, setZoomLevel] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isReExtracting, setIsReExtracting] = useState(false);

  if (!selectedInvoice) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        No invoice selected. Please choose a bill from the dashboard.
      </div>
    );
  }

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 20, 200));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 20, 60));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleRerun = () => {
    setIsReExtracting(true);
    setTimeout(() => {
      rerunExtraction(selectedInvoice.id);
      setIsReExtracting(false);
    }, 700);
  };

  const handleConfirmAndMatch = () => {
    confirmMatch(selectedInvoice.id, selectedInvoice.vendorId, selectedInvoice.propertyId);
    setActiveTab('matching');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Document Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-700">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">
                Bill Intake & AI Extraction Workspace
              </h1>
              <span className="text-xs text-slate-500 font-mono">
                {selectedInvoice.invoiceNumber}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Interactive dual-pane OCR inspection · Confidence: {selectedInvoice.confidenceScore}% · Intake: {selectedInvoice.intakeMethod.replace('_', ' ')}
            </p>
          </div>
        </div>

        {/* Invoice Selector Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Select Bill:</span>
          <select
            value={selectedInvoiceId || ''}
            onChange={(e) => setSelectedInvoiceId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-md py-1.5 px-3 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
          >
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoiceNumber} — {inv.vendorName} (${inv.amount.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dual-Pane Interface Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* LEFT PANE: Interactive Document Viewer (6 cols) */}
        <div className="lg:col-span-6 bg-slate-800 rounded-lg border border-slate-700 flex flex-col overflow-hidden shadow-xs">
          {/* Document Viewer Toolbar */}
          <div className="h-11 bg-slate-900 border-b border-slate-700 px-4 flex items-center justify-between text-slate-300">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-slate-400">PDF Preview</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 font-mono">{zoomLevel}%</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                title="Toggle OCR Bounding Boxes"
                className={`p-1.5 rounded transition-colors text-xs flex items-center gap-1 ${
                  showBoundingBoxes ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">OCR Boxes</span>
              </button>
              <div className="h-4 w-px bg-slate-700 mx-1" />
              <button
                onClick={handleZoomOut}
                title="Zoom Out"
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomIn}
                title="Zoom In"
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleRotate}
                title="Rotate Document"
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Document Canvas Viewport */}
          <div className="flex-1 p-6 overflow-auto bg-slate-900/60 flex items-center justify-center relative">
            <div
              style={{
                transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease-out',
              }}
              className="w-[440px] min-h-[580px] bg-white text-slate-900 p-8 shadow-2xl rounded relative select-none border border-slate-300 font-sans text-xs"
            >
              {/* Document Header */}
              <div className="border-b border-slate-300 pb-4 mb-4 flex justify-between items-start">
                <div>
                  <div className={`font-bold text-base text-slate-900 ${showBoundingBoxes ? 'ring-1 ring-emerald-500 bg-emerald-50/50 p-1 rounded' : ''}`}>
                    {selectedInvoice.vendorName}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Remittance & Invoicing Dept.<br />
                    Tax ID: 36-9281044 · License #48102
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-slate-800">INVOICE</div>
                  <div className={`font-mono text-xs font-semibold text-slate-700 mt-1 ${showBoundingBoxes ? 'ring-1 ring-blue-500 bg-blue-50/50 p-0.5 rounded' : ''}`}>
                    #{selectedInvoice.invoiceNumber}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Acct: {selectedInvoice.accountNumber}
                  </div>
                </div>
              </div>

              {/* Bill-To Payer Entity */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className={`${showBoundingBoxes ? 'ring-1 ring-indigo-500 bg-indigo-50/40 p-1.5 rounded' : ''}`}>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Bill To (Payer):</span>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {selectedInvoice.propertyName}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Commercial Property Mgmt Office<br />
                    Accounts Payable Division
                  </div>
                </div>

                <div className="text-right text-[11px] space-y-1">
                  <div>
                    <span className="text-slate-400">Issue Date:</span>{' '}
                    <span className="font-mono font-medium">{selectedInvoice.issueDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Due Date:</span>{' '}
                    <span className="font-mono font-medium text-rose-600">{selectedInvoice.dueDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Terms:</span> Net 30
                  </div>
                </div>
              </div>

              {/* Line Items Table on Document */}
              <div className="mb-6">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-500">
                      <th className="pb-1.5 font-semibold">Description</th>
                      <th className="pb-1.5 text-center font-semibold">Qty</th>
                      <th className="pb-1.5 text-right font-semibold">Rate</th>
                      <th className="pb-1.5 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedInvoice.lineItems.map((li) => (
                      <tr key={li.id} className={`${showBoundingBoxes ? 'ring-1 ring-amber-400/80 bg-amber-50/30' : ''}`}>
                        <td className="py-2 pr-2 text-slate-800">{li.description}</td>
                        <td className="py-2 px-1 text-center font-mono text-slate-600">{li.quantity}</td>
                        <td className="py-2 px-1 text-right font-mono text-slate-600">${li.unitRate.toFixed(2)}</td>
                        <td className="py-2 pl-2 text-right font-mono font-semibold text-slate-900">${li.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Section */}
              <div className="border-t border-slate-200 pt-3 flex justify-end">
                <div className="w-48 text-[11px] space-y-1 text-right">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono">${selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax / Regulatory:</span>
                    <span className="font-mono">${selectedInvoice.tax.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between text-sm font-bold border-t border-slate-300 pt-1.5 text-slate-900 ${showBoundingBoxes ? 'ring-2 ring-emerald-600 bg-emerald-50/70 p-1 rounded' : ''}`}>
                    <span>Total Due:</span>
                    <span className="font-mono">${selectedInvoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Watermark / OCR verified badge */}
              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>OCR Bounding Box Engine · V2</span>
                <span>CONFIDENCE: {selectedInvoice.confidenceScore}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Extracted Structured Data Form (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            {/* Form Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Extracted Data Form
                </h2>
                <p className="text-xs text-slate-500">
                  Verified values extracted from document headers and line item breakdown
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors flex items-center gap-1 ${
                    isEditing ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Lock Form' : 'Manual Edit'}</span>
                </button>

                <button
                  onClick={handleRerun}
                  disabled={isReExtracting}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReExtracting ? 'animate-spin' : ''}`} />
                  <span>Re-run AI</span>
                </button>
              </div>
            </div>

            {/* Form Inputs Grid */}
            <div className="p-5 space-y-4 max-h-[460px] overflow-y-auto">
              {/* Payee Vendor & Payer Property */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Vendor (Payee)
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={selectedInvoice.vendorName}
                    onChange={(e) => updateExtractedInvoice(selectedInvoice.id, { vendorName: e.target.value })}
                    className="w-full text-xs font-medium px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 disabled:bg-slate-50/70"
                  />
                  <div className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> AI Extracted & Linked
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Commercial Property (Payer)
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={selectedInvoice.propertyName}
                    onChange={(e) => updateExtractedInvoice(selectedInvoice.id, { propertyName: e.target.value })}
                    className="w-full text-xs font-medium px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 disabled:bg-slate-50/70"
                  />
                  <div className="text-[10px] text-slate-500 mt-1">
                    Matched from address block
                  </div>
                </div>
              </div>

              {/* Invoice # and Account # */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={selectedInvoice.invoiceNumber}
                    onChange={(e) => updateExtractedInvoice(selectedInvoice.id, { invoiceNumber: e.target.value })}
                    className="w-full text-xs font-mono font-medium px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 disabled:bg-slate-50/70"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Account / Ref Number
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={selectedInvoice.accountNumber}
                    onChange={(e) => updateExtractedInvoice(selectedInvoice.id, { accountNumber: e.target.value })}
                    className="w-full text-xs font-mono font-medium px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 disabled:bg-slate-50/70"
                  />
                </div>
              </div>

              {/* Issue Date & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    disabled={!isEditing}
                    value={selectedInvoice.issueDate}
                    onChange={(e) => updateExtractedInvoice(selectedInvoice.id, { issueDate: e.target.value })}
                    className="w-full text-xs font-mono px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 disabled:bg-slate-50/70"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Payment Due Date
                  </label>
                  <input
                    type="date"
                    disabled={!isEditing}
                    value={selectedInvoice.dueDate}
                    onChange={(e) => updateExtractedInvoice(selectedInvoice.id, { dueDate: e.target.value })}
                    className="w-full text-xs font-mono px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 disabled:bg-slate-50/70"
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Line Items ({selectedInvoice.lineItems.length})
                </label>
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 font-medium">Description</th>
                        <th className="px-3 py-2 font-medium text-center">Qty</th>
                        <th className="px-3 py-2 font-medium text-right">Rate</th>
                        <th className="px-3 py-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvoice.lineItems.map((li) => (
                        <tr key={li.id}>
                          <td className="px-3 py-2 text-slate-800 font-medium">
                            {li.description}
                            {li.glCode && (
                              <span className="block text-[10px] text-slate-400 font-mono">
                                GL: {li.glCode}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-slate-600">
                            {li.quantity}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600">
                            ${li.unitRate.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                            ${li.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Totals Breakdown */}
              <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-medium">${selectedInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Tax & Regulatory Fees:</span>
                  <span className="font-mono font-medium">${selectedInvoice.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                  <span>Total Amount Due:</span>
                  <span className="font-mono">${selectedInvoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Extraction confidence: <span className="font-mono font-semibold text-slate-800">{selectedInvoice.confidenceScore}%</span>
            </div>

            <button
              onClick={handleConfirmAndMatch}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors shadow-xs"
            >
              <span>Confirm & Move to Matching</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
