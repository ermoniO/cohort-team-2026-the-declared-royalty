import React, { useState, useEffect } from 'react';
import { X, Building2, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { Property } from '../types';
import { CreatePropertyInput } from '../app/adapters/propertyAdapter';
import { useInvoiceStore } from '../context/InvoiceContext';
import { SelectDropdown } from './ui/SelectDropdown';

interface CreatePropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreatePropertyInput) => Promise<Property>;
}

export const CreatePropertyModal: React.FC<CreatePropertyModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const { propertyCategories } = useInvoiceStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState(
    propertyCategories[0]?.categoryCode || ''
  );
  const [ownerEntity, setOwnerEntity] = useState('');
  const [sqft, setSqft] = useState('');

  useEffect(() => {
    if (!category && propertyCategories.length > 0) {
      setCategory(propertyCategories[0].categoryCode);
    }
  }, [propertyCategories, category]);
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !streetAddress.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit({
        name: name.trim(),
        category,
        ownerEntity: ownerEntity.trim() || undefined,
        sqft: sqft ? parseInt(sqft, 10) : undefined,
        streetAddress: streetAddress.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        zipCode: zipCode.trim(),
      });
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create property.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#25362f]/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-[#e6ebe8] max-w-[540px] w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e6ebe8] flex items-center justify-between bg-[#f8faf9]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#e8f7ed] text-[#16834a] rounded-lg border border-[#d7ebdd]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#14532d]">Add Managed Property</h2>
              <p className="text-xs text-[#68766f]">Configure physical asset with structured address</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#68766f] hover:text-[#14532d] p-1 rounded-md hover:bg-[#e8f7ed] transition-colors cursor-pointer"
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

          {/* Property Name */}
          <div>
            <label className="block text-xs font-medium text-[#25362f] mb-1">
              Property Asset Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grandview Office Tower"
              className="w-full text-xs px-3 py-2 bg-white border border-[#e6ebe8] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#16834a]/20 focus:border-[#16834a] placeholder:text-[#98a29c] text-[#25362f]"
            />
          </div>

          {/* Property Category */}
          <div>
            <label className="block text-xs font-medium text-[#25362f] mb-1">
              Property Category <span className="text-rose-500">*</span>
            </label>
            <SelectDropdown
              ariaLabel="Property Category"
              value={category}
              onChange={setCategory}
              disabled={propertyCategories.length === 0}
              placeholder="Loading categories..."
              options={propertyCategories.map((cat) => ({
                value: cat.categoryCode,
                label: cat.name,
              }))}
            />
          </div>

          {/* Owner Entity & Square Footage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#25362f] mb-1">
                Owner Entity / Title Holder
              </label>
              <input
                type="text"
                value={ownerEntity}
                onChange={(e) => setOwnerEntity(e.target.value)}
                placeholder="e.g. Apex Holdings LLC"
                className="w-full text-xs px-3 py-2 bg-white border border-[#e6ebe8] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#16834a]/20 focus:border-[#16834a] placeholder:text-[#98a29c] text-[#25362f]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#25362f] mb-1">
                Gross Building Area (sq ft)
              </label>
              <input
                type="number"
                min={0}
                value={sqft}
                onChange={(e) => setSqft(e.target.value)}
                placeholder="e.g. 250000"
                className="w-full text-xs px-3 py-2 bg-white border border-[#e6ebe8] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#16834a]/20 focus:border-[#16834a] placeholder:text-[#98a29c] text-[#25362f] font-mono"
              />
            </div>
          </div>

          {/* Discrete Address Section */}
          <div className="pt-2 border-t border-[#e6ebe8] space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#14532d]">
              <MapPin className="w-3.5 h-3.5 text-[#16834a]" />
              <span>Physical Address (JSONB)</span>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#68766f] mb-1">
                Street Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="e.g. 450 North Michigan Ave"
                className="w-full text-xs px-3 py-2 bg-white border border-[#e6ebe8] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#16834a]/20 focus:border-[#16834a] placeholder:text-[#98a29c] text-[#25362f]"
              />
            </div>

            <div className="grid grid-cols-12 gap-2.5">
              <div className="col-span-6">
                <label className="block text-[11px] font-medium text-[#68766f] mb-1">
                  City <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Chicago"
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e6ebe8] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#16834a]/20 focus:border-[#16834a] placeholder:text-[#98a29c] text-[#25362f]"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-[#68766f] mb-1">
                  State <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  placeholder="IL"
                  className="w-full text-xs px-2.5 py-2 uppercase bg-white border border-[#e6ebe8] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#16834a]/20 focus:border-[#16834a] text-[#25362f] text-center font-mono"
                />
              </div>

              <div className="col-span-4">
                <label className="block text-[11px] font-medium text-[#68766f] mb-1">
                  ZIP Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="60611"
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e6ebe8] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#16834a]/20 focus:border-[#16834a] text-[#25362f] font-mono"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#e6ebe8] flex items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-[#25362f] hover:text-[#14532d] bg-white border border-[#e6ebe8] hover:bg-[#f8faf9] rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <span>Creating...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Create Property</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
