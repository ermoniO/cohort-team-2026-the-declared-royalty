import React, { useState, useEffect } from 'react';
import { X, Building, CreditCard, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { Vendor, PaymentMethod } from '../types';
import { CreateVendorInput } from '../app/adapters/vendorAdapter';
import { useInvoiceStore } from '../context/InvoiceContext';

interface CreateVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateVendorInput) => Promise<Vendor>;
}

export const CreateVendorModal: React.FC<CreateVendorModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const { vendorCategories, paymentMethods } = useInvoiceStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState(
    vendorCategories[0]?.categoryCode || ''
  );
  const [taxId, setTaxId] = useState('');
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<PaymentMethod>(
    paymentMethods[0]?.methodCode || ''
  );

  useEffect(() => {
    if (!category && vendorCategories.length > 0) {
      setCategory(vendorCategories[0].categoryCode);
    }
  }, [vendorCategories, category]);

  useEffect(() => {
    if (!defaultPaymentMethod && paymentMethods.length > 0) {
      setDefaultPaymentMethod(paymentMethods[0].methodCode);
    }
  }, [paymentMethods, defaultPaymentMethod]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [remittanceAddress, setRemittanceAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !category.trim() || !taxId.trim()) {
      setErrorMessage('Please fill in vendor name, category, and tax ID.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit({
        name: name.trim(),
        category,
        taxId: taxId.trim(),
        defaultPaymentMethod,
        phoneNumber: phoneNumber.trim() || undefined,
        paymentUrl: paymentUrl.trim() || undefined,
        remittanceAddress: remittanceAddress.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to onboard vendor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Onboard New Vendor</h2>
              <p className="text-xs text-slate-500">Register payee credentials, tax ID, and payment routing</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Vendor Legal Name */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Vendor Legal Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apex Utilities & HVAC Services"
              className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400 text-slate-800"
            />
          </div>

          {/* Vendor Category */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Industry Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
            >
              {vendorCategories.length > 0 ? (
                vendorCategories.map((cat) => (
                  <option key={cat.categoryCode} value={cat.categoryCode}>
                    {cat.name}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  Loading categories...
                </option>
              )}
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
              <span>Default Disbursement Method</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.length > 0 ? (
                paymentMethods.map((method) => (
                  <button
                    key={method.methodCode}
                    type="button"
                    onClick={() => setDefaultPaymentMethod(method.methodCode)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all text-center ${
                      defaultPaymentMethod === method.methodCode
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 font-semibold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {method.name}
                  </button>
                ))
              ) : (
                <div className="col-span-3 text-xs text-slate-400 py-2">
                  Loading payment methods...
                </div>
              )}
            </div>
          </div>

          {/* Tax & Remittance Section */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Compliance & Remittance</span>
            </div>

            <div className="grid grid-cols-12 gap-2.5">
              <div className="col-span-5">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Tax ID / EIN <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="XX-XXXXXXX"
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-slate-800"
                />
              </div>

              <div className="col-span-7">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Billing Phone
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="555-0192"
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Remittance Address
              </label>
              <input
                type="text"
                value={remittanceAddress}
                onChange={(e) => setRemittanceAddress(e.target.value)}
                placeholder="PO Box 1000, Commercial Suite, Chicago, IL 60611"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Payment Portal URL
              </label>
              <input
                type="url"
                value={paymentUrl}
                onChange={(e) => setPaymentUrl(e.target.value)}
                placeholder="https://pay.vendorportal.com"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400 text-slate-800"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              {isSubmitting ? (
                <span>Onboarding...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Onboard Vendor</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

