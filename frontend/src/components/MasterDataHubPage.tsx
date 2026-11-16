import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  GitCompare,
  Layers,
  Plus,
  Search,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Truck,
  X,
} from 'lucide-react';
import { getPropertyGlAccounts } from '@/app/services/propertyService';
import {
  computeActionRequiredBreakdown,
  NAVIGATION_SECTIONS,
} from '@/config/navigation';
import { useInvoiceStore } from '@/context/InvoiceContext';
import type { Property, PropertyVendorRelationship } from '@/types';
import type { PropertyGlAccountResponse } from '@/types/api';
import { DEFAULT_GL_OPTIONS, UUID_REGEX } from '@/features/invoices/invoiceFormat';
import { CreatePropertyModal } from './CreatePropertyModal';
import { CreateVendorModal } from './CreateVendorModal';
import { PageHeader } from './layout/PageHeader';
import { SelectDropdown } from './ui/SelectDropdown';

export type MasterDataTab = 'properties' | 'vendors' | 'mappings';

export const MasterDataHubPage: React.FC<{
  initialTab?: MasterDataTab;
}> = ({ initialTab = 'properties' }) => {
  const {
    invoices,
    properties,
    scopedProperties,
    isPropertiesLive,
    vendors,
    isVendorsLive,
    mappings,
    addNewProperty,
    addNewVendor,
    addMapping,
    toggleAutoApproval,
    updateMappingTerms,
    setActiveTab,
  } = useInvoiceStore();

  const navConfig = NAVIGATION_SECTIONS.flatMap((s) => s.items).find(
    (item) => item.id === 'master_data'
  );

  const [subTab, setSubTab] = useState<MasterDataTab>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);

  // View GL Accounts modal state
  const [selectedPropertyForGl, setSelectedPropertyForGl] =
    useState<Property | null>(null);
  const [propertyGlList, setPropertyGlList] = useState<
    PropertyGlAccountResponse[]
  >([]);
  const [isLoadingPropGl, setIsLoadingPropGl] = useState(false);

  // Create Mapping modal state
  const [isNewMappingOpen, setIsNewMappingOpen] = useState(false);
  const [newMapPropertyId, setNewMapPropertyId] = useState('');
  const [newMapVendorId, setNewMapVendorId] = useState('');
  const [newMapAccountNumber, setNewMapAccountNumber] = useState('');
  const [newMapCostType, setNewMapCostType] = useState<
    'FIXED_MONTHLY' | 'VARIABLE'
  >('VARIABLE');
  const [newMapGlCode, setNewMapGlCode] = useState('');
  const [newMapAutoApproval, setNewMapAutoApproval] = useState(false);
  const [newMapStatus, setNewMapStatus] = useState<'ACTIVE' | 'INACTIVE'>(
    'ACTIVE'
  );
  const [newMapGlAccounts, setNewMapGlAccounts] = useState<
    PropertyGlAccountResponse[]
  >([]);
  const [isCreatingMapping, setIsCreatingMapping] = useState(false);

  // Edit Contract Terms modal state
  const [editingMapping, setEditingMapping] =
    useState<PropertyVendorRelationship | null>(null);
  const [editGlAccounts, setEditGlAccounts] = useState<
    PropertyGlAccountResponse[]
  >([]);
  const [selectedCostType, setSelectedCostType] = useState<
    'FIXED_MONTHLY' | 'VARIABLE'
  >('VARIABLE');
  const [selectedGlCode, setSelectedGlCode] = useState('');
  const [isLoadingEditGl, setIsLoadingEditGl] = useState(false);

  const unmatchedCount = useMemo(
    () => computeActionRequiredBreakdown(invoices).needsMatching.length,
    [invoices]
  );

  const query = searchTerm.trim().toLowerCase();

  const filteredProperties = useMemo(
    () =>
      properties.filter((p) => {
        if (!query) return true;
        return `${p.name} ${p.address} ${p.propertyType} ${p.ownerEntity || ''} ${p.managerName}`
          .toLowerCase()
          .includes(query);
      }),
    [properties, query]
  );

  const filteredVendors = useMemo(
    () =>
      vendors.filter((v) => {
        if (!query) return true;
        return `${v.name} ${v.category} ${v.accountNumber} ${v.taxId}`
          .toLowerCase()
          .includes(query);
      }),
    [vendors, query]
  );

  const filteredMappings = useMemo(
    () =>
      mappings.filter((m) => {
        if (!query) return true;
        const propName =
          properties.find((p) => p.id === m.propertyId)?.name || '';
        const vendName =
          vendors.find((v) => v.id === m.vendorId)?.name || '';
        return `${propName} ${vendName} ${m.vendorAccountNumber} ${m.defaultGlCode || ''}`
          .toLowerCase()
          .includes(query);
      }),
    [mappings, properties, vendors, query]
  );

  useEffect(() => {
    if (!selectedPropertyForGl) {
      setPropertyGlList([]);
      return;
    }
    if (!UUID_REGEX.test(selectedPropertyForGl.id)) {
      setPropertyGlList([]);
      return;
    }
    let cancelled = false;
    setIsLoadingPropGl(true);
    getPropertyGlAccounts(selectedPropertyForGl.id)
      .then((accounts) => {
        if (!cancelled) setPropertyGlList(accounts);
      })
      .catch(() => {
        if (!cancelled) setPropertyGlList([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPropGl(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPropertyForGl]);

  useEffect(() => {
    if (!isNewMappingOpen || !newMapPropertyId) {
      setNewMapGlAccounts([]);
      return;
    }
    if (!UUID_REGEX.test(newMapPropertyId)) {
      setNewMapGlAccounts([]);
      return;
    }
    let cancelled = false;
    getPropertyGlAccounts(newMapPropertyId)
      .then((accounts) => {
        if (!cancelled) setNewMapGlAccounts(accounts);
      })
      .catch(() => {
        if (!cancelled) setNewMapGlAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isNewMappingOpen, newMapPropertyId]);

  const handleOpenNewMapping = () => {
    setNewMapPropertyId(scopedProperties[0]?.id ?? properties[0]?.id ?? '');
    setNewMapVendorId(vendors[0]?.id ?? '');
    setNewMapAccountNumber('');
    setNewMapCostType('VARIABLE');
    setNewMapGlCode('');
    setNewMapAutoApproval(false);
    setNewMapStatus('ACTIVE');
    setIsNewMappingOpen(true);
  };

  const handleCreateMappingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMapPropertyId || !newMapVendorId || !newMapAccountNumber.trim()) {
      return;
    }
    setIsCreatingMapping(true);
    try {
      await addMapping({
        propertyId: newMapPropertyId,
        vendorId: newMapVendorId,
        vendorAccountNumber: newMapAccountNumber.trim(),
        costType: newMapCostType,
        defaultGlCode: newMapGlCode || undefined,
        autoApprovalEnabled: newMapAutoApproval,
        status: newMapStatus,
      });
      setIsNewMappingOpen(false);
    } finally {
      setIsCreatingMapping(false);
    }
  };

  const handleOpenEditTerms = async (mapping: PropertyVendorRelationship) => {
    setEditingMapping(mapping);
    setSelectedCostType(mapping.costType || 'VARIABLE');
    setSelectedGlCode(mapping.defaultGlCode || '');
    if (!UUID_REGEX.test(mapping.propertyId)) {
      setEditGlAccounts([]);
      return;
    }
    setIsLoadingEditGl(true);
    try {
      const accounts = await getPropertyGlAccounts(mapping.propertyId);
      setEditGlAccounts(accounts);
    } catch {
      setEditGlAccounts([]);
    } finally {
      setIsLoadingEditGl(false);
    }
  };

  const handleSaveTerms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMapping) return;
    updateMappingTerms(editingMapping.id, {
      costType: selectedCostType,
      defaultGlCode: selectedGlCode || undefined,
    });
    setEditingMapping(null);
  };

  const primaryAction =
    subTab === 'properties'
      ? {
          label: 'New Property',
          icon: <Plus className="w-3.5 h-3.5" />,
          onClick: () => setIsAddPropertyOpen(true),
        }
      : subTab === 'vendors'
        ? {
            label: 'New Vendor',
            icon: <Plus className="w-3.5 h-3.5" />,
            onClick: () => setIsAddVendorOpen(true),
          }
        : {
            label: 'New Mapping',
            icon: <Plus className="w-3.5 h-3.5" />,
            onClick: handleOpenNewMapping,
          };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={navConfig?.label || 'Properties & Vendors'}
        subtitle={
          navConfig?.subtitle ||
          'Centralized master data directory for managed properties, vendor payees, and GL account mappings'
        }
        primaryAction={primaryAction}
      />

      {/* Sub-Tabs & Directory Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-[#e6ebe8] shadow-2xs w-fit">
          {[
            {
              id: 'properties' as MasterDataTab,
              label: `Properties (${properties.length})`,
              icon: Building2,
            },
            {
              id: 'vendors' as MasterDataTab,
              label: `Vendors (${vendors.length})`,
              icon: Truck,
            },
            {
              id: 'mappings' as MasterDataTab,
              label: `Account Mappings (${mappings.length})`,
              icon: GitCompare,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const selected = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selected
                    ? 'bg-[#e8f7ed] text-[#14532d]'
                    : 'text-[#68766f] hover:text-[#14532d] hover:bg-[#f8faf9]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-[#98a29c] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search ${subTab}...`}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#e6ebe8] rounded-lg text-[#25362f] placeholder:text-[#98a29c] focus:outline-none focus:border-[#16834a]"
          />
        </div>
      </div>

      {/* TAB 1: PROPERTIES */}
      {subTab === 'properties' && (
        <div className="bg-white rounded-xl border border-[#e6ebe8] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8faf9] text-[#68766f] border-b border-[#e6ebe8] font-semibold">
                <tr>
                  <th className="px-4 py-3">Property Building</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Owner / Manager</th>
                  <th className="px-4 py-3 text-right">Square Footage</th>
                  <th className="px-4 py-3 text-right">Auto-Pay Mappings</th>
                  <th className="px-4 py-3 text-right">GL Chart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6ebe8]">
                {filteredProperties.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-[#68766f]"
                    >
                      No properties match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredProperties.map((prop) => (
                    <tr
                      key={prop.id}
                      className="hover:bg-[#f6fbf8] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#14532d]">
                          {prop.name}
                        </div>
                        <div className="text-[11px] text-[#68766f]">
                          {prop.address}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f8faf9] border border-[#e6ebe8] text-[#25362f]">
                          {prop.propertyType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#25362f]">
                          {prop.ownerEntity || 'Portfolio Asset'}
                        </div>
                        <div className="text-[11px] text-[#68766f]">
                          {prop.managerName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#25362f]">
                        {prop.sqft.toLocaleString()} sq ft
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(() => {
                          const propMappings = mappings.filter(
                            (m) => m.propertyId === prop.id && m.status === 'ACTIVE'
                          );
                          const autoCount = propMappings.filter((m) => m.autoApprovalEnabled).length;
                          return autoCount > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#e8f7ed] text-[#14532d] border border-[#d7ebdd]">
                              {autoCount} Auto-Pay Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f8faf9] text-[#68766f] border border-[#e6ebe8]">
                              Manual Review
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedPropertyForGl(prop)}
                          className="px-2.5 py-1 text-xs font-semibold text-[#14532d] bg-[#e8f7ed] hover:bg-[#d7ebdd] rounded-md border border-[#d7ebdd] inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Layers className="w-3 h-3 text-[#16834a]" />
                          <span>View GL Accounts</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: VENDORS */}
      {subTab === 'vendors' && (
        <div className="bg-white rounded-xl border border-[#e6ebe8] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8faf9] text-[#68766f] border-b border-[#e6ebe8] font-semibold">
                <tr>
                  <th className="px-4 py-3">Vendor Payee</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Tax ID &amp; Account #</th>
                  <th className="px-4 py-3">Default Rail</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Historical Matches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6ebe8]">
                {filteredVendors.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-[#68766f]"
                    >
                      No vendors match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((vendor) => (
                    <tr
                      key={vendor.id}
                      className="hover:bg-[#f6fbf8] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#14532d]">
                          {vendor.name}
                        </div>
                        <div className="text-[11px] text-[#68766f]">
                          {vendor.remittanceAddress}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#25362f]">
                        {vendor.category}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-[#68766f]">
                        TIN: {vendor.taxId || '—'} · Acct:{' '}
                        {vendor.accountNumber || '—'}
                      </td>
                      <td className="px-4 py-3 uppercase font-mono text-[11px] text-[#25362f]">
                        {vendor.defaultPaymentMethod}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${
                            vendor.status === 'verified'
                              ? 'bg-[#e8f7ed] text-[#14532d] border-[#d7ebdd]'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {vendor.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#14532d]">
                        {vendor.historicalMatchesCount} invoices
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ACCOUNT MAPPINGS */}
      {subTab === 'mappings' && (
        <div className="space-y-4">
          {unmatchedCount > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                    Unmatched Invoices ({unmatchedCount})
                  </h3>
                  <p className="text-xs text-amber-900 mt-0.5">
                    {unmatchedCount} incoming invoice
                    {unmatchedCount === 1 ? ' lacks' : 's lack'} a verified
                    property-vendor mapping pair and require human triage.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('action_required')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg transition-colors shrink-0 shadow-xs cursor-pointer"
              >
                <span>Review in Action Required</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-[#e6ebe8] shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#16834a]" />
                <h2 className="text-sm font-bold text-[#14532d]">
                  Property-Vendor Relationship Junction ({filteredMappings.length})
                </h2>
              </div>
              <span className="text-[11px] text-[#68766f]">
                Default GL codes, recurring contract terms, and auto-approval rules
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8faf9] text-[#68766f] border-b border-[#e6ebe8] font-semibold">
                  <tr>
                    <th className="px-4 py-3">Property Entity</th>
                    <th className="px-4 py-3">Vendor Payee</th>
                    <th className="px-4 py-3">Account #</th>
                    <th className="px-4 py-3">Cost Type &amp; GL</th>
                    <th className="px-4 py-3">Auto-Approve</th>
                    <th className="px-4 py-3 text-right">Configure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6ebe8]">
                  {filteredMappings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-[#68766f]"
                      >
                        No property-vendor mappings configured.
                      </td>
                    </tr>
                  ) : (
                    filteredMappings.map((m) => {
                      const prop = properties.find((p) => p.id === m.propertyId);
                      const vend = vendors.find((v) => v.id === m.vendorId);
                      return (
                        <tr
                          key={m.id}
                          className="hover:bg-[#f6fbf8] transition-colors"
                        >
                          <td className="px-4 py-3 font-semibold text-[#14532d]">
                            {prop?.name || m.propertyId}
                          </td>
                          <td className="px-4 py-3 font-medium text-[#25362f]">
                            {vend?.name || m.vendorId}
                          </td>
                          <td className="px-4 py-3 font-mono text-[#68766f]">
                            {m.vendorAccountNumber}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[#f8faf9] border border-[#e6ebe8] text-[#25362f]">
                              {m.costType || 'VARIABLE'}
                            </span>
                            {m.defaultGlCode && (
                              <span className="ml-2 font-mono text-[11px] text-[#68766f]">
                                GL {m.defaultGlCode}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={m.autoApprovalEnabled}
                              onClick={() => toggleAutoApproval(m.id)}
                              className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                                m.autoApprovalEnabled
                                  ? 'bg-[#e8f7ed] border-[#b7e2c7] text-[#14532d] hover:bg-[#d7ebdd]'
                                  : 'bg-[#f8faf9] border-[#e6ebe8] text-[#68766f] hover:bg-[#eef2ef]'
                              }`}
                            >
                              <span
                                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                                  m.autoApprovalEnabled ? 'bg-[#16834a]' : 'bg-[#cbd5cf]'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                    m.autoApprovalEnabled ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </span>
                              <span>{m.autoApprovalEnabled ? 'Enabled' : 'Off'}</span>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenEditTerms(m)}
                              className="px-2.5 py-1 text-xs font-semibold text-[#14532d] bg-white hover:bg-[#f8faf9] border border-[#e6ebe8] rounded-md inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Sliders className="w-3 h-3 text-[#16834a]" />
                              <span>Edit Terms</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Standardized 540px GL Accounts Modal */}
      {selectedPropertyForGl && (
        <div className="fixed inset-0 z-50 bg-[#25362f]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#e6ebe8] shadow-2xl max-w-[540px] w-full">
            <div className="px-6 py-4 border-b border-[#e6ebe8] flex items-center justify-between bg-[#f8faf9] rounded-t-xl">
              <div>
                <h3 className="text-sm font-bold text-[#14532d]">
                  GL Chart of Accounts · {selectedPropertyForGl.name}
                </h3>
                <p className="text-xs text-[#68766f] mt-0.5">
                  Active general ledger codes assigned to this property entity
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPropertyForGl(null)}
                className="text-[#68766f] hover:text-[#14532d] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-80 overflow-y-auto space-y-2 text-xs">
              {isLoadingPropGl ? (
                <div className="py-6 text-center text-[#68766f]">
                  Loading GL accounts...
                </div>
              ) : (
                (propertyGlList.length > 0
                  ? propertyGlList
                  : DEFAULT_GL_OPTIONS.map((g) => ({
                      glCode: g.glCode,
                      glAccountName: g.glAccountName,
                      isActive: true,
                    }))
                ).map((ga) => (
                  <div
                    key={ga.glCode}
                    className="p-3 rounded-lg border border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#14532d]">
                        {ga.glCode}
                      </span>
                      <span className="ml-2 text-[#25362f] font-medium">
                        {ga.glAccountName}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#e8f7ed] text-[#14532d]">
                      Active
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between">
              <span className="text-[11px] text-[#68766f]">
                Synced from property ERP ledger
              </span>
              <button
                type="button"
                onClick={() => setSelectedPropertyForGl(null)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standardized 540px Edit Contract Terms Modal */}
      {editingMapping && (
        <div className="fixed inset-0 z-50 bg-[#25362f]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#e6ebe8] shadow-2xl max-w-[540px] w-full">
            <div className="px-6 py-4 border-b border-[#e6ebe8] flex items-center justify-between bg-[#f8faf9] rounded-t-xl">
              <h3 className="text-sm font-bold text-[#14532d]">
                Edit Contract Terms · {editingMapping.vendorAccountNumber}
              </h3>
              <button
                type="button"
                onClick={() => setEditingMapping(null)}
                className="text-[#68766f] hover:text-[#14532d] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTerms}>
              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-[#25362f] font-semibold mb-1">
                    Contract Cost Type
                  </label>
                  <SelectDropdown
                    ariaLabel="Contract Cost Type"
                    value={selectedCostType}
                    onChange={(val) =>
                      setSelectedCostType(val as 'FIXED_MONTHLY' | 'VARIABLE')
                    }
                    options={[
                      { value: 'FIXED_MONTHLY', label: 'FIXED_MONTHLY (Recurring)' },
                      { value: 'VARIABLE', label: 'VARIABLE (Time & Materials)' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-[#25362f] font-semibold mb-1">
                    Default GL Code
                  </label>
                  <SelectDropdown
                    ariaLabel="Default GL Code"
                    value={selectedGlCode}
                    onChange={setSelectedGlCode}
                    disabled={isLoadingEditGl}
                    options={[
                      { value: '', label: isLoadingEditGl ? 'Loading GL accounts...' : 'No Default GL Code' },
                      ...(editGlAccounts.length > 0 ? editGlAccounts : DEFAULT_GL_OPTIONS).map((ga) => ({
                        value: ga.glCode,
                        label: `${ga.glCode} - ${ga.glAccountName}`,
                      })),
                    ]}
                  />
                </div>
              </div>

              <div className="px-6 py-3.5 border-t border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setEditingMapping(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#68766f] hover:text-[#14532d] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg shadow-xs cursor-pointer"
                >
                  Save Contract Terms
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Standardized 540px Create New Mapping Modal */}
      {isNewMappingOpen && (
        <div className="fixed inset-0 z-50 bg-[#25362f]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#e6ebe8] shadow-2xl max-w-[540px] w-full">
            <div className="px-6 py-4 border-b border-[#e6ebe8] flex items-center justify-between bg-[#f8faf9] rounded-t-xl">
              <h3 className="text-sm font-bold text-[#14532d]">
                Create Property-Vendor Mapping
              </h3>
              <button
                type="button"
                onClick={() => setIsNewMappingOpen(false)}
                className="text-[#68766f] hover:text-[#14532d] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMappingSubmit}>
              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-[#25362f] font-semibold mb-1">
                    Property Entity (Payer) *
                  </label>
                  <SelectDropdown
                    ariaLabel="Property Entity (Payer)"
                    value={newMapPropertyId}
                    onChange={setNewMapPropertyId}
                    options={properties.map((p) => ({
                      value: p.id,
                      label: `${p.name} - ${p.address}`,
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-[#25362f] font-semibold mb-1">
                    Vendor (Payee) *
                  </label>
                  <SelectDropdown
                    ariaLabel="Vendor (Payee)"
                    value={newMapVendorId}
                    onChange={setNewMapVendorId}
                    options={vendors.map((v) => ({
                      value: v.id,
                      label: `${v.name} (${v.category})`,
                    }))}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#25362f] font-semibold mb-1">
                      Vendor Account Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={newMapAccountNumber}
                      onChange={(e) => setNewMapAccountNumber(e.target.value)}
                      placeholder="e.g. 2000456705"
                      className="w-full px-3 py-2 border border-[#e6ebe8] rounded-lg bg-white text-[#25362f] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[#25362f] font-semibold mb-1">
                      Cost Type *
                    </label>
                    <SelectDropdown
                      ariaLabel="Cost Type"
                      value={newMapCostType}
                      onChange={(val) =>
                        setNewMapCostType(val as 'FIXED_MONTHLY' | 'VARIABLE')
                      }
                      options={[
                        { value: 'FIXED_MONTHLY', label: 'FIXED_MONTHLY' },
                        { value: 'VARIABLE', label: 'VARIABLE' },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#25362f] font-semibold mb-1">
                      Default GL Code
                    </label>
                    <SelectDropdown
                      ariaLabel="Default GL Code"
                      value={newMapGlCode}
                      onChange={setNewMapGlCode}
                      options={[
                        { value: '', label: 'No Default GL Code' },
                        ...(newMapGlAccounts.length > 0
                          ? newMapGlAccounts
                          : DEFAULT_GL_OPTIONS
                        ).map((ga) => ({
                          value: ga.glCode,
                          label: `${ga.glCode} - ${ga.glAccountName}`,
                        })),
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-[#25362f] font-semibold mb-1">
                      Mapping Status *
                    </label>
                    <SelectDropdown
                      ariaLabel="Mapping Status"
                      value={newMapStatus}
                      onChange={(val) => setNewMapStatus(val as 'ACTIVE' | 'INACTIVE')}
                      options={[
                        { value: 'ACTIVE', label: 'ACTIVE' },
                        { value: 'INACTIVE', label: 'INACTIVE' },
                      ]}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#e6ebe8] bg-[#f8faf9] cursor-pointer text-[#25362f]">
                  <input
                    type="checkbox"
                    checked={newMapAutoApproval}
                    onChange={(e) => setNewMapAutoApproval(e.target.checked)}
                    className="rounded text-[#16834a] focus:ring-[#16834a]"
                  />
                  <span className="font-medium">
                    Enable straight-through auto-approval for this pair
                  </span>
                </label>
              </div>

              <div className="px-6 py-3.5 border-t border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsNewMappingOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#68766f] hover:text-[#14532d] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingMapping}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
                >
                  {isCreatingMapping ? 'Saving...' : 'Create Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shared Standardized Modals */}
      <CreatePropertyModal
        isOpen={isAddPropertyOpen}
        onClose={() => setIsAddPropertyOpen(false)}
        onSubmit={addNewProperty}
      />

      <CreateVendorModal
        isOpen={isAddVendorOpen}
        onClose={() => setIsAddVendorOpen(false)}
        onSubmit={addNewVendor}
      />
    </div>
  );
};
