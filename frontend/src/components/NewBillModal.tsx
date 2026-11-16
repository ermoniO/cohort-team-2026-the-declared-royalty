import React, { useState } from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import { FileUp, X, RotateCw, UploadCloud, CheckCircle, FileText, Trash2, AlertCircle } from 'lucide-react';
import { IntakeMethod } from '../types';
import { uploadInvoice } from '@/app/services/invoiceUploadService';
import { SelectDropdown } from './ui/SelectDropdown';
import { DatePicker } from './ui/DatePicker';

interface NewBillModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewBillModal: React.FC<NewBillModalProps> = ({ isOpen, onClose }) => {
  const { vendors, properties, addNewInvoice, openInvoiceWorkspace } = useInvoiceStore();

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const findByKeyword = <T extends { id: string; name: string }>(items: T[], keyword: string) =>
    items.find((i) => i.name.toLowerCase().includes(keyword.toLowerCase()))?.id || items[0]?.id || '';

  const handleApplyPreset = (type: 'utility' | 'maintenance' | 'capital') => {
    if (type === 'utility') {
      setVendorId(findByKeyword(vendors, 'water'));
      setPropertyId(findByKeyword(properties, 'grandview'));
      setAmount(435.50);
      setNotes('Monthly commercial water and municipal storm sewer.');
    } else if (type === 'maintenance') {
      setVendorId(findByKeyword(vendors, 'hvac'));
      setPropertyId(findByKeyword(properties, 'harborfront'));
      setAmount(2800.00);
      setNotes('Rooftop air handler unit seasonal filter replacement and belt tensioning.');
    } else {
      setVendorId(findByKeyword(vendors, 'roofing'));
      setPropertyId(findByKeyword(properties, 'metro'));
      setAmount(18400.00);
      setNotes('Warehouse high-bay skylight resealing and metal flashing repair.');
    }
  };

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (list.length === 0) return;
    setSelectedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const uniqueNew = list.filter((f) => !existingKeys.has(`${f.name}:${f.size}`));
      const next = [...prev, ...uniqueNew];
      if (next.length === 1) {
        setInvoiceNumber(next[0].name.replace(/\.[^/.]+$/, ''));
      }
      setUploadFeedback(`${next.length} PDF${next.length === 1 ? '' : 's'} queued for upload`);
      return next;
    });
    setUploadError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setUploadFeedback(
        next.length > 0 ? `${next.length} PDF${next.length === 1 ? '' : 's'} queued for upload` : null
      );
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (selectedFiles.length > 0) {
      setIsUploading(true);
      const uploadedIds: string[] = [];
      const errors: string[] = [];
      try {
        for (const file of selectedFiles) {
          try {
            const uploadResult = await uploadInvoice(file);
            const newId = addNewInvoice({
              id: uploadResult.invoiceId,
              invoiceNumber: uploadResult.originalFilename || file.name.replace(/\.[^/.]+$/, ''),
              vendorId,
              propertyId,
              amount: Number(amount),
              issueDate,
              dueDate,
              intakeMethod,
              status: 'intake',
              backendStatus: 'INGESTED',
              notes: `Uploaded live PDF: ${file.name}`,
            });
            uploadedIds.push(newId);
          } catch (err: unknown) {
            errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed'}`);
          }
        }
        if (errors.length > 0) {
          setUploadError(errors.join(' · '));
        }
        if (uploadedIds.length > 0 && errors.length === 0) {
          setSelectedFiles([]);
          onClose();
          openInvoiceWorkspace(uploadedIds[0]);
        }
      } finally {
        setIsUploading(false);
      }
      return;
    }

    addNewInvoice({
      invoiceNumber,
      vendorId,
      propertyId,
      amount: Number(amount),
      issueDate,
      dueDate,
      intakeMethod,
      status: 'intake',
      backendStatus: 'INGESTED',
      notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#25362f]/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-[540px] rounded-xl border border-[#e6ebe8] shadow-2xl animate-in fade-in duration-200">
        {/* Header */}
        <div className="p-5 border-b border-[#e6ebe8] flex items-center justify-between bg-[#f8faf9] rounded-t-xl">
          <div>
            <h3 className="text-base font-bold text-[#14532d] flex items-center gap-2">
              <FileUp className="w-4 h-4 text-[#16834a]" />
              Ingest New Invoice
            </h3>
            <p className="text-xs text-[#68766f] mt-0.5">
              Live invoice upload, AI OCR line-item extraction, and payer policy routing
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[#68766f] hover:text-[#14532d] hover:bg-[#e8f7ed] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Presets Row */}
        <div className="px-6 pt-4">
          <label className="block text-[10px] font-semibold text-[#68766f] uppercase tracking-wider mb-2">
            Quick Ingest Presets:
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleApplyPreset('utility')}
              className="px-2.5 py-1 text-xs font-medium text-[#14532d] bg-[#f8faf9] hover:bg-[#e8f7ed] rounded border border-[#e6ebe8] transition-colors cursor-pointer"
            >
              Water Utility ($435.50)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('maintenance')}
              className="px-2.5 py-1 text-xs font-medium text-[#14532d] bg-[#f8faf9] hover:bg-[#e8f7ed] rounded border border-[#e6ebe8] transition-colors cursor-pointer"
            >
              HVAC Repair ($2,800.00)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('capital')}
              className="px-2.5 py-1 text-xs font-medium text-[#14532d] bg-[#f8faf9] hover:bg-[#e8f7ed] rounded border border-[#e6ebe8] transition-colors cursor-pointer"
            >
              Roofing Capital ($18,400.00)
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* File Upload Drop Area (Multi-PDF) */}
          <div>
            <label className="block font-semibold text-[#25362f] mb-1">
              Invoice Documents (Multi-PDF Supported)
            </label>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.length) {
                  addFiles(e.dataTransfer.files);
                }
              }}
              className={`flex flex-col items-center justify-center p-3.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                isDragging
                  ? 'border-[#16834a] bg-[#e8f7ed]'
                  : 'border-[#d7ebdd] bg-[#f6fbf8] hover:border-[#16834a] hover:bg-[#e8f7ed]/50'
              }`}
            >
              <UploadCloud className="w-6 h-6 text-[#16834a] mb-1" />
              <span className="text-xs text-[#25362f] font-medium">
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} PDF${selectedFiles.length === 1 ? '' : 's'} ready — click or drop to add more`
                  : 'Click to select or drop one or more invoice PDFs'}
              </span>
              <span className="text-[10px] text-[#68766f] mt-0.5">
                Uploaded directly to backend MinIO/PostgreSQL; opens extraction queue
              </span>
              <input
                type="file"
                multiple
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {selectedFiles.length > 0 && (
              <div className="mt-2 max-h-28 overflow-y-auto space-y-1.5 pr-1">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${file.size}-${idx}`}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#f8faf9] border border-[#e6ebe8] text-[11px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-[#16834a] shrink-0" />
                      <span className="font-medium text-[#25362f] truncate">{file.name}</span>
                      <span className="text-[#68766f] shrink-0">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      aria-label={`Remove ${file.name}`}
                      className="text-[#68766f] hover:text-rose-600 p-0.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadFeedback && (
              <p className="text-[11px] text-[#16834a] mt-1.5 flex items-center gap-1 font-medium">
                <CheckCircle className="w-3.5 h-3.5" /> {uploadFeedback}
              </p>
            )}
            {uploadError && (
              <p className="text-[11px] text-rose-600 mt-1.5 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {uploadError}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#25362f] mb-1">Invoice Number</label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full font-mono text-xs p-2 border border-[#e6ebe8] rounded focus:outline-none focus:ring-1 focus:ring-[#16834a] focus:border-[#16834a]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#25362f] mb-1">Total Amount ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full font-mono font-bold text-xs p-2 border border-[#e6ebe8] rounded focus:outline-none focus:ring-1 focus:ring-[#16834a] focus:border-[#16834a]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#25362f] mb-1">Payee Vendor</label>
              <SelectDropdown
                ariaLabel="Payee Vendor"
                value={vendorId}
                onChange={setVendorId}
                options={vendors.map((v) => ({ value: v.id, label: v.name }))}
              />
            </div>

            <div>
              <label className="block font-semibold text-[#25362f] mb-1">Payer Property</label>
              <SelectDropdown
                ariaLabel="Payer Property"
                value={propertyId}
                onChange={setPropertyId}
                options={properties.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#25362f] mb-1">Issue Date</label>
              <DatePicker
                ariaLabel="Issue Date"
                value={issueDate}
                onChange={setIssueDate}
              />
            </div>

            <div>
              <label className="block font-semibold text-[#25362f] mb-1">Due Date</label>
              <DatePicker
                ariaLabel="Due Date"
                value={dueDate}
                onChange={setDueDate}
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#25362f] mb-1">Intake Method</label>
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
                  className={`py-1.5 px-2 rounded border text-center transition-colors text-[11px] font-medium cursor-pointer ${
                    intakeMethod === m.id
                      ? 'bg-[#e8f7ed] text-[#14532d] border-[#16834a] font-semibold'
                      : 'bg-[#f8faf9] border-[#e6ebe8] text-[#68766f] hover:bg-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#25362f] mb-1">Description / Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-2 border border-[#e6ebe8] rounded focus:outline-none focus:ring-1 focus:ring-[#16834a]"
            />
          </div>

          <div className="p-4 border-t border-[#e6ebe8] bg-[#f8faf9] -mx-6 -mb-6 mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#25362f] hover:text-[#14532d] bg-white border border-[#e6ebe8] hover:bg-[#f8faf9] rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#16834a] rounded-lg hover:bg-[#13723f] transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading to Backend...</span>
                </>
              ) : (
                <span>Ingest & Run AI Extraction</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
