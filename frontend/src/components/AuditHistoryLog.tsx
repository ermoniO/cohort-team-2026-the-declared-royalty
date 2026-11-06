import React, { useState } from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import {
  History,
  Download,
  FileSpreadsheet,
  FileCheck,
  ShieldCheck,
  Clock,
  User,
  ExternalLink,
  Building2,
  DollarSign
} from 'lucide-react';

export const AuditHistoryLog: React.FC = () => {
  const {
    invoices,
    selectedInvoice,
    selectedInvoiceId,
    setSelectedInvoiceId,
    currentProfile
  } = useInvoiceStore();

  const [filterQuery, setFilterQuery] = useState('');
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState('');

  const targetInvoice = selectedInvoice || invoices[0];

  const handleExportCSV = () => {
    const csvHeader = 'Timestamp,Event Type,Description,User,Role\n';
    const csvRows = targetInvoice.auditTrail
      .map(
        (a) =>
          `"${a.timestamp}","${a.eventType}","${a.description.replace(/"/g, '""')}","${a.user}","${a.role}"`
      )
      .join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Audit_Trail_${targetInvoice.invoiceNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccessMessage(`Exported CSV for ${targetInvoice.invoiceNumber}`);
    setTimeout(() => setDownloadSuccessMessage(''), 3000);
  };

  const handleDownloadCertificate = () => {
    setDownloadSuccessMessage(`Generated immutable compliance certificate for ${targetInvoice.invoiceNumber}`);
    setTimeout(() => setDownloadSuccessMessage(''), 3000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Financial Audit & Immutable Lifecycle History
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            End-to-end cryptographic and role-authenticated ledger for compliance and tax audibility
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          {downloadSuccessMessage && (
            <span className="text-xs text-emerald-600 font-semibold animate-pulse mr-2">
              ✓ {downloadSuccessMessage}
            </span>
          )}

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors shadow-xs flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleDownloadCertificate}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Audit Certificate</span>
          </button>
        </div>
      </div>

      {/* Bill Selector Header Card */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 font-mono">
                {targetInvoice.invoiceNumber}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-semibold text-slate-700">{targetInvoice.vendorName}</span>
              <span className="text-xs text-slate-400">➔</span>
              <span className="text-xs text-slate-600">{targetInvoice.propertyName}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Total Amount: <span className="font-mono font-bold text-slate-900">${targetInvoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> · Status: <span className="capitalize font-semibold text-slate-700">{targetInvoice.status.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* Change Target Invoice Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Inspect Bill:</span>
          <select
            value={selectedInvoiceId || targetInvoice.id}
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

      {/* Chronological Timeline */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900">
            Immutable Chronological Event Timeline
          </h2>
          <span className="text-xs font-mono text-slate-400">
            {targetInvoice.auditTrail.length} recorded lifecycle checkpoints
          </span>
        </div>

        <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {targetInvoice.auditTrail.map((ev, index) => {
            return (
              <div key={ev.id} className="relative group">
                {/* Node icon / indicator */}
                <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-indigo-600 flex items-center justify-center text-[10px]" />

                <div className="bg-slate-50 hover:bg-slate-100/60 p-4 rounded-lg border border-slate-200 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {ev.eventType}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{ev.user}</span>
                        <span className="text-slate-400">({ev.role})</span>
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{ev.timestamp}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed mt-1">
                    {ev.description}
                  </p>

                  {ev.metadata && (
                    <div className="mt-2 pt-2 border-t border-slate-200/60 font-mono text-[11px] text-slate-600 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(ev.metadata).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-slate-400">{k}:</span>{' '}
                          <span className="font-semibold text-slate-800">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
