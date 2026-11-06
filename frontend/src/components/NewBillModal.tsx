import React, { useState } from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import { FileUp, X, Sparkles, Building2, Truck } from 'lucide-react';
import { IntakeMethod } from '../types';

interface NewBillModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewBillModal: React.FC<NewBillModalProps> = ({ isOpen, onClose }) => {
  const { vendors, properties, addNewInvoice, currentProfile } = useInvoiceStore();

  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Math.floor(2000 + Math.random() * 8000)}`);
  const [vendorId, setVendorId] = useState(vendors[0]?.id || '');
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
  const [amount, setAmount] = useState(1250);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().substring(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10)
  );
  const [intakeMethod, setIntakeMethod] = useState<IntakeMethod>('pdf_upload');
  const [notes, setNotes] = useState('Routine commercial building service invoice.');

  if (!isOpen) return null;

  const handleApplyPreset = (type: 'utility' | 'maintenance' | 'capital') => {
    if (type === 'utility') {
      setVendorId('ven-pacific-water');
      setPropertyId('prop-grandview');
      setAmount(435.50);
      setNotes('Monthly commercial water and municipal storm sewer.');
    } else if (type === 'maintenance') {
      setVendorId('ven-apex-hvac');
      setPropertyId('prop-harborfront');
      setAmount(2800.00);
      setNotes('Rooftop air handler unit seasonal filter replacement and belt tensioning.');
    } else {
      setVendorId('ven-vanguard-roofing');
      setPropertyId('prop-metropolitan');
      setAmount(18400.00);
      setNotes('Warehouse high-bay skylight resealing and metal flashing repair.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addNewInvoice({
      invoiceNumber,
      vendorId,
      propertyId,
      amount: Number(amount),
      issueDate,
      dueDate,
      intakeMethod,
      notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileUp className="w-4 h-4 text-indigo-600" />
              Ingest New Commercial Bill
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulate invoice ingestion, AI OCR line-item extraction, and payer policy routing
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Presets Row */}
        <div className="px-6 pt-4">
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Quick Ingest Presets:
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleApplyPreset('utility')}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
            >
              Water Utility ($435.50)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('maintenance')}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
            >
              HVAC Repair ($2,800.00)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('capital')}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
            >
              Roofing Capital ($18,400.00)
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Invoice Number</label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full font-mono text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Total Amount ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full font-mono font-bold text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payee Vendor</label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payer Property</label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Issue Date</label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full font-mono text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full font-mono text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Intake Method</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'pdf_upload', label: 'PDF Upload' },
                { id: 'email_parsing', label: 'Email AP' },
                { id: 'manual_entry', label: 'Manual' },
                { id: 'edi_feed', label: 'EDI Feed' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setIntakeMethod(m.id as IntakeMethod)}
                  className={`py-1.5 px-2 rounded border text-center transition-colors text-[11px] font-medium ${
                    intakeMethod === m.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description / Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50 -mx-6 -mb-6 mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors shadow-xs"
            >
              Ingest & Run AI Extraction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
