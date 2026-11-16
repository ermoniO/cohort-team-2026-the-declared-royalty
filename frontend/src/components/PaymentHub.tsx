import React, { useState } from 'react';
import { NAVIGATION_SECTIONS } from '@/config/navigation';
import { useInvoiceStore } from '../context/InvoiceContext';
import { Invoice, PaymentMethod } from '../types';
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  RotateCw,
  Send,
  Zap,
  ArrowRight,
  X
} from 'lucide-react';
import { isInvoiceReadyForDisbursement } from '@/features/invoices/invoiceFormat';
import { PageHeader } from './layout/PageHeader';

export const PaymentHub: React.FC = () => {
  const {
    invoices,
    executeStripePayment,
    batchExecutePayments,
    openInvoiceWorkspace,
    setActiveTab
  } = useInvoiceStore();

  const navConfig = NAVIGATION_SECTIONS.flatMap((s) => s.items).find(
    (item) => item.id === 'disbursements'
  );

  const [activeRail, setActiveRail] = useState<PaymentMethod>('CREDIT_CARD');
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [selectedInvoicesForBatch, setSelectedInvoicesForBatch] = useState<string[]>([]);

  // Stripe card entry simulation form
  const [testCardNumber, setTestCardNumber] = useState('4242 4242 4242 4242');
  const [testExp, setTestExp] = useState('12/28');
  const [testCvc, setTestCvc] = useState('123');
  const [testPostal, setTestPostal] = useState('90210');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionResult, setTransactionResult] = useState<{
    success?: boolean;
    message?: string;
    chargeId?: string;
  } | null>(null);

  // Filter approved invoices ready for payment (shared selector with Sidebar disbursements badge)
  const readyInvoices = invoices.filter(isInvoiceReadyForDisbursement);

  const settledInvoices = invoices.filter(
    (inv) => inv.status === 'paid'
  );

  const handleOpenStripeModal = (inv: Invoice) => {
    setPayingInvoice(inv);
    setTransactionResult(null);
    setTestCardNumber('4242 4242 4242 4242');
  };

  const handleExecutePayment = async (cardType: 'success' | 'decline' | 'insufficient') => {
    if (!payingInvoice) return;
    setIsProcessing(true);
    setTransactionResult(null);

    const res = await executeStripePayment(payingInvoice.id, cardType);
    setIsProcessing(false);
    setTransactionResult(res);
  };

  const handleBatchRelease = async () => {
    if (selectedInvoicesForBatch.length === 0) return;
    setIsProcessing(true);
    await batchExecutePayments(selectedInvoicesForBatch);
    setIsProcessing(false);
    setSelectedInvoicesForBatch([]);
  };

  const totalReadyAmount = readyInvoices.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={navConfig?.label || 'Disbursements'}
        subtitle={
          navConfig?.subtitle ||
          'Approved invoices ready for settlement and historical disbursement ledger'
        }
        primaryAction={
          selectedInvoicesForBatch.length > 0
            ? {
                label: `Release Batch Payments ($${readyInvoices
                  .filter((i) => selectedInvoicesForBatch.includes(i.id))
                  .reduce((s, i) => s + i.amount, 0)
                  .toLocaleString()})`,
                icon: <Send className="w-3.5 h-3.5" />,
                onClick: handleBatchRelease,
                disabled: isProcessing,
              }
            : undefined
        }
      >
        <div className="text-xs font-mono text-[#14532d] bg-white border border-[#e6ebe8] px-3 py-1.5 rounded-lg">
          Ready to Disburse:{' '}
          <span className="font-bold">
            ${totalReadyAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>{' '}
          ({readyInvoices.length} invoices)
        </div>
      </PageHeader>

      {/* Payment Rails Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { id: 'CREDIT_CARD', label: 'Credit Card (Stripe TEST)', desc: 'Direct instant test card charge' },
          { id: 'ACH', label: 'ACH Direct Debit', desc: 'NACHA standard bank transfer' },
          { id: 'CHECK', label: 'Check Print', desc: 'Physical lockbox check checkrun' },
        ].map((rail) => {
          const isSelected = activeRail === rail.id;
          return (
            <button
              key={rail.id}
              type="button"
              onClick={() => setActiveRail(rail.id as PaymentMethod)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#e8f7ed] text-[#14532d] border-[#16834a] shadow-2xs'
                  : 'bg-white hover:bg-[#f8faf9] border-[#e6ebe8] text-[#25362f]'
              }`}
            >
              <div className="text-xs font-bold">{rail.label}</div>
              <div className={`text-[11px] mt-0.5 ${isSelected ? 'text-[#14532d]/80' : 'text-[#68766f]'}`}>
                {rail.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Payment Execution Queue Table */}
      <div className="bg-white rounded-xl border border-[#e6ebe8] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#14532d]">
              Approved Invoices Awaiting Disbursement ({readyInvoices.length})
            </h3>
            <p className="text-xs text-[#68766f]">
              Invoices approved by policy rule or authorized human manager
            </p>
          </div>

          {readyInvoices.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (selectedInvoicesForBatch.length === readyInvoices.length) {
                  setSelectedInvoicesForBatch([]);
                } else {
                  setSelectedInvoicesForBatch(readyInvoices.map((i) => i.id));
                }
              }}
              className="text-xs text-[#16834a] hover:text-[#13723f] font-semibold cursor-pointer"
            >
              {selectedInvoicesForBatch.length === readyInvoices.length ? 'Deselect All' : 'Select All Ready'}
            </button>
          )}
        </div>

        {readyInvoices.length === 0 ? (
          <div className="p-12 text-center text-[#68766f] text-xs">
            No invoices currently awaiting disbursement. All approved invoices have been settled.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8faf9] text-[#68766f] border-b border-[#e6ebe8] font-semibold">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedInvoicesForBatch.length === readyInvoices.length && readyInvoices.length > 0}
                      onChange={() => {
                        if (selectedInvoicesForBatch.length === readyInvoices.length) setSelectedInvoicesForBatch([]);
                        else setSelectedInvoicesForBatch(readyInvoices.map((i) => i.id));
                      }}
                      className="rounded text-[#16834a] focus:ring-[#16834a]"
                    />
                  </th>
                  <th className="px-4 py-3">Invoice Details</th>
                  <th className="px-4 py-3">Payer Property</th>
                  <th className="px-4 py-3 text-right">Amount Due</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3">Approval Reference</th>
                  <th className="px-4 py-3 text-right">Execute</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6ebe8] text-[#25362f]">
                {readyInvoices.map((inv) => {
                  const isSelected = selectedInvoicesForBatch.includes(inv.id);
                  return (
                    <tr key={inv.id} className="hover:bg-[#f6fbf8] transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedInvoicesForBatch((prev) =>
                              prev.includes(inv.id) ? prev.filter((i) => i !== inv.id) : [...prev, inv.id]
                            );
                          }}
                          className="rounded text-[#16834a] focus:ring-[#16834a]"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openInvoiceWorkspace(inv.id)}
                          className="font-mono font-semibold text-[#16834a] hover:underline cursor-pointer"
                        >
                          {inv.invoiceNumber}
                        </button>
                        <div className="text-[11px] text-[#68766f]">{inv.vendorName}</div>
                      </td>

                      <td className="px-4 py-3 font-medium text-[#25362f]">
                        {inv.propertyName}
                      </td>

                      <td className="px-4 py-3 font-mono font-bold text-[#14532d] text-right tabular-nums text-sm">
                        ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-[#68766f] uppercase">
                          {inv.paymentInfo?.method.replace('_', ' ') || 'STRIPE TEST CC'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-[11px]">
                        <span className="font-semibold text-[#16834a]">Policy Approved</span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenStripeModal(inv)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-300" />
                          <span>Pay with Stripe</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Batch Action Strip */}
        {selectedInvoicesForBatch.length > 0 && (
          <div className="p-4 bg-[#f8faf9] border-t border-[#e6ebe8] flex items-center justify-between">
            <span className="text-xs font-medium text-[#25362f]">
              {selectedInvoicesForBatch.length} invoice(s) selected for disbursement
            </span>
            <button
              type="button"
              onClick={handleBatchRelease}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Release Batch Payments (${readyInvoices.filter(i => selectedInvoicesForBatch.includes(i.id)).reduce((s, i) => s + i.amount, 0).toLocaleString()})</span>
            </button>
          </div>
        )}
      </div>

      {/* Settled Disbursements Section */}
      <div className="bg-white rounded-xl border border-[#e6ebe8] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#14532d]">
              Recent Settled Disbursements ({settledInvoices.length})
            </h3>
            <p className="text-xs text-[#68766f]">
              Completed transactions with Stripe charge IDs and bank authorization codes
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('audit_ledger')}
            className="text-xs text-[#16834a] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            Full Audit Ledger <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8faf9] text-[#68766f] border-b border-[#e6ebe8] font-semibold">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Payee Vendor</th>
                <th className="px-4 py-3">Payer Property</th>
                <th className="px-4 py-3 text-right">Settled Amount</th>
                <th className="px-4 py-3">Stripe Charge Ref</th>
                <th className="px-4 py-3">Settlement Date</th>
                <th className="px-4 py-3 text-right">Workspace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6ebe8] text-[#25362f]">
              {settledInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-[#f6fbf8] transition-colors">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openInvoiceWorkspace(inv.id)}
                      className="font-mono font-semibold text-[#16834a] hover:underline cursor-pointer"
                    >
                      {inv.invoiceNumber}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-[#14532d]">
                    {inv.vendorName}
                  </td>
                  <td className="px-4 py-3 text-[#68766f]">
                    {inv.propertyName}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-[#16834a] text-right tabular-nums">
                    ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#68766f]">
                    {inv.paymentInfo?.transactionRef || 'ch_3M9qX2...'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[#68766f] text-[11px]">
                    {inv.paymentInfo?.paidAt || '2026-11-03 10:22'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openInvoiceWorkspace(inv.id)}
                      className="text-xs text-[#16834a] font-semibold hover:underline cursor-pointer"
                    >
                      Inspect Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stripe TEST CC Modal Component (Standardized 540px) */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 bg-[#25362f]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[540px] rounded-xl border border-[#e6ebe8] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#e6ebe8] flex items-center justify-between bg-[#f8faf9]">
              <div>
                <h3 className="text-sm font-bold text-[#14532d] flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#16834a]" />
                  Stripe TEST Credit Card Terminal
                </h3>
                <p className="text-xs text-[#68766f] mt-0.5">
                  Paying {payingInvoice.invoiceNumber} · ${payingInvoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="p-1 rounded text-[#68766f] hover:text-[#14532d] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-xs">
              <div>
                <label className="block font-semibold text-[#68766f] uppercase tracking-wider text-[10px] mb-2">
                  Quick Fill Stripe Test Cards
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTestCardNumber('4242 4242 4242 4242')}
                    className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      testCardNumber.startsWith('4242')
                        ? 'bg-[#e8f7ed] border-[#16834a] text-[#14532d]'
                        : 'bg-[#f8faf9] border-[#e6ebe8] text-[#25362f] hover:bg-[#e8f7ed]/40'
                    }`}
                  >
                    <div className="font-bold text-[11px]">Success Card</div>
                    <div className="text-[10px] text-[#68766f] font-mono">4242...</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTestCardNumber('4000 0000 0000 0002')}
                    className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      testCardNumber.endsWith('0002')
                        ? 'bg-rose-50 border-rose-300 text-rose-900'
                        : 'bg-[#f8faf9] border-[#e6ebe8] text-[#25362f] hover:bg-rose-50/40'
                    }`}
                  >
                    <div className="font-bold text-[11px]">Decline Card</div>
                    <div className="text-[10px] text-[#68766f] font-mono">...0002</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTestCardNumber('4000 0000 0000 9995')}
                    className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      testCardNumber.endsWith('9995')
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-[#f8faf9] border-[#e6ebe8] text-[#25362f] hover:bg-amber-50/40'
                    }`}
                  >
                    <div className="font-bold text-[11px]">Insufficient</div>
                    <div className="text-[10px] text-[#68766f] font-mono">...9995</div>
                  </button>
                </div>
              </div>

              {/* Card Form */}
              <div className="space-y-3 p-4 bg-[#f8faf9] rounded-lg border border-[#e6ebe8]">
                <div>
                  <label className="block text-[11px] font-semibold text-[#25362f] mb-1">
                    Card Number
                  </label>
                  <input
                    type="text"
                    value={testCardNumber}
                    onChange={(e) => setTestCardNumber(e.target.value)}
                    className="w-full font-mono text-xs px-3 py-2 bg-white border border-[#e6ebe8] rounded-lg focus:outline-none focus:border-[#16834a]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#25362f] mb-1">
                      Expires
                    </label>
                    <input
                      type="text"
                      value={testExp}
                      onChange={(e) => setTestExp(e.target.value)}
                      className="w-full font-mono text-xs px-3 py-2 bg-white border border-[#e6ebe8] rounded-lg focus:outline-none focus:border-[#16834a]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#25362f] mb-1">
                      CVC
                    </label>
                    <input
                      type="text"
                      value={testCvc}
                      onChange={(e) => setTestCvc(e.target.value)}
                      className="w-full font-mono text-xs px-3 py-2 bg-white border border-[#e6ebe8] rounded-lg focus:outline-none focus:border-[#16834a]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#25362f] mb-1">
                      ZIP
                    </label>
                    <input
                      type="text"
                      value={testPostal}
                      onChange={(e) => setTestPostal(e.target.value)}
                      className="w-full font-mono text-xs px-3 py-2 bg-white border border-[#e6ebe8] rounded-lg focus:outline-none focus:border-[#16834a]"
                    />
                  </div>
                </div>
              </div>

              {/* Transaction Result Feedback */}
              {transactionResult && (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    transactionResult.success
                      ? 'bg-[#e8f7ed] border-[#d7ebdd] text-[#14532d]'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {transactionResult.success ? (
                      <CheckCircle className="w-4 h-4 text-[#16834a]" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{transactionResult.message}</span>
                  </div>
                  {transactionResult.chargeId && (
                    <div className="text-[10px] font-mono mt-1 text-[#14532d]">
                      Charge ID: {transactionResult.chargeId}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-3.5 border-t border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#68766f] hover:text-[#14532d] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() =>
                  handleExecutePayment(
                    testCardNumber.endsWith('0002')
                      ? 'decline'
                      : testCardNumber.endsWith('9995')
                      ? 'insufficient'
                      : 'success'
                  )
                }
                className="px-5 py-1.5 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Authorizing with Stripe...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>Charge ${payingInvoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
