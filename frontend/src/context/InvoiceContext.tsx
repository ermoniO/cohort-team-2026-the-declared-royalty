import React, { createContext, useContext, useState } from 'react';
import {
  Invoice,
  Property,
  Vendor,
  PayerPolicy,
  UserRole,
  NavTab,
  ActivityItem,
  RoleProfile,
  AppUser,
  PropertyVendorRelationship,
} from '../types';
import { useAuth } from '../hooks/useAuth';
import { useMasterData } from '../hooks/useMasterData';
import { useInvoices } from '../hooks/useInvoices';
import { CreatePropertyInput } from '../app/adapters/propertyAdapter';
import { CreateVendorInput } from '../app/adapters/vendorAdapter';
import type { PropertyCategoryResponse, VendorCategoryResponse, PaymentMethodResponse } from '@/types/api';

interface InvoiceContextType {
  // Auth & Session
  currentUser: AppUser;
  setCurrentUser: (user: AppUser) => void;
  availableUsers: AppUser[];
  activeRole: UserRole;
  currentProfile: RoleProfile;
  setActiveRole: (role: UserRole) => void;

  // Navigation & Global Filters
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  actionRequiredFilter: 'all' | 'matching' | 'approvals' | 'exceptions';
  setActionRequiredFilter: (filter: 'all' | 'matching' | 'approvals' | 'exceptions') => void;
  openActionRequired: (filter?: 'all' | 'matching' | 'approvals' | 'exceptions') => void;
  workspaceInvoiceId: string | null;
  openInvoiceWorkspace: (invoiceId: string) => void;
  closeInvoiceWorkspace: () => void;
  isNewBillOpen: boolean;
  setIsNewBillOpen: (open: boolean) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  propertyFilter: string;
  setPropertyFilter: (p: string) => void;

  // Master Data
  properties: Property[];
  scopedProperties: Property[];
  isPropertiesLive: boolean;
  refreshProperties: () => Promise<void>;
  addNewProperty: (input: CreatePropertyInput) => Promise<Property>;
  vendors: Vendor[];
  isVendorsLive: boolean;
  refreshVendors: () => Promise<void>;
  addNewVendor: (input: CreateVendorInput) => Promise<Vendor>;
  propertyCategories: PropertyCategoryResponse[];
  vendorCategories: VendorCategoryResponse[];
  paymentMethods: PaymentMethodResponse[];
  mappings: PropertyVendorRelationship[];
  isMappingsLive: boolean;
  refreshMappings: () => Promise<void>;
  toggleAutoApproval: (mappingId: string) => Promise<void>;
  updateMappingTerms: (
    mappingId: string,
    updates: { costType: 'FIXED_MONTHLY' | 'VARIABLE'; defaultGlCode?: string; status?: 'ACTIVE' | 'INACTIVE' }
  ) => Promise<void>;
  addMapping: (
    mapping: Omit<PropertyVendorRelationship, 'id' | 'propertyName' | 'vendorName'> & {
      propertyName?: string;
      vendorName?: string;
    }
  ) => Promise<PropertyVendorRelationship>;
  companyPolicy: PayerPolicy;
  updatePropertyPolicy: (propertyId: string, policy: Partial<PayerPolicy>) => void;
  updateCompanyPolicy: (policy: Partial<PayerPolicy>) => void;
  evaluatePolicyForInvoice: (
    amount: number,
    propertyId: string,
    confidence: number
  ) => {
    isAutoApproved: boolean;
    tier: 'auto_approved' | 'property_manager' | 'vp_finance';
    effectiveMaxAmount: number;
    requiresHumanReview: boolean;
    reason: string;
  };

  // Invoices & Workflow
  invoices: Invoice[];
  selectedInvoiceId: string | null;
  setSelectedInvoiceId: (id: string | null) => void;
  selectedInvoice: Invoice | undefined;
  activities: ActivityItem[];
  approveInvoice: (invoiceId: string, note?: string) => Promise<boolean>;
  bulkApproveInvoices: (
    invoiceIds: string[],
    note?: string
  ) => Promise<{ approvedCount: number; skippedCount: number }>;
  rejectInvoice: (invoiceId: string, reason: string) => Promise<void>;
  requestReevaluation: (invoiceId: string, reason: string) => Promise<void>;
  dismissDuplicate: (invoiceId: string, reason: string) => void;
  resolveException: (invoiceId: string, actionNote: string, newVendorId?: string) => void;
  executeStripePayment: (
    invoiceId: string,
    testCardType?: 'success' | 'decline' | 'insufficient'
  ) => Promise<{ success: boolean; message: string; chargeId?: string }>;
  batchExecutePayments: (invoiceIds: string[]) => Promise<{ processed: number; succeeded: number }>;
  confirmMatch: (invoiceId: string, vendorId: string, propertyId: string, mappingId?: string) => Promise<void>;
  rerunExtraction: (invoiceId: string) => Promise<void>;
  updateExtractedInvoice: (invoiceId: string, updates: Partial<Invoice>) => void;
  addNewInvoice: (newInvoiceData: Partial<Invoice>) => string;
}

const InvoiceContext = createContext<InvoiceContextType | undefined>(undefined);

export const InvoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation & Global Filters
  const [activeTabState, setActiveTabState] = useState<NavTab>('overview');
  const [actionRequiredFilter, setActionRequiredFilter] = useState<
    'all' | 'matching' | 'approvals' | 'exceptions'
  >('all');
  const [workspaceInvoiceId, setWorkspaceInvoiceId] = useState<string | null>(null);
  const [isNewBillOpen, setIsNewBillOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');

  const setActiveTab = (tab: NavTab) => {
    setActiveTabState(tab);
    setWorkspaceInvoiceId(null);
    if (tab !== 'action_required') {
      setActionRequiredFilter('all');
    }
  };

  const openActionRequired = (
    filter: 'all' | 'matching' | 'approvals' | 'exceptions' = 'all'
  ) => {
    setActionRequiredFilter(filter);
    setActiveTabState('action_required');
    setWorkspaceInvoiceId(null);
  };

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  // Master Data Hook (Properties, Vendors, Mappings, Policies)
  const masterData = useMasterData();

  // Auth & Session Hook (User switching, role profiles, property scoping)
  const auth = useAuth(masterData.properties);

  // Invoices & Lifecycle Hook (Ingestion, OCR, Matching, Approvals, Payments)
  const invoiceData = useInvoices({
    currentUser: auth.currentUser,
    currentProfile: auth.currentProfile,
    properties: masterData.properties,
    vendors: masterData.vendors,
    mappings: masterData.mappings,
    evaluatePolicyForInvoice: masterData.evaluatePolicyForInvoice,
  });

  const openInvoiceWorkspace = (invoiceId: string) => {
    invoiceData.setSelectedInvoiceId(invoiceId);
    setWorkspaceInvoiceId(invoiceId);
    setActiveTabState('invoices');
  };

  const closeInvoiceWorkspace = () => {
    setWorkspaceInvoiceId(null);
  };

  return (
    <InvoiceContext.Provider
      value={{
        // Auth
        currentUser: auth.currentUser,
        setCurrentUser: auth.setCurrentUser,
        availableUsers: auth.availableUsers,
        activeRole: auth.activeRole,
        currentProfile: auth.currentProfile,
        setActiveRole: auth.setActiveRole,

        // Navigation & Filters
        activeTab: activeTabState,
        setActiveTab,
        actionRequiredFilter,
        setActionRequiredFilter,
        openActionRequired,
        workspaceInvoiceId,
        openInvoiceWorkspace,
        closeInvoiceWorkspace,
        isNewBillOpen,
        setIsNewBillOpen,
        isSidebarOpen,
        setIsSidebarOpen,
        toggleSidebar,
        searchQuery,
        setSearchQuery,
        propertyFilter,
        setPropertyFilter,

        // Master Data
        properties: masterData.properties,
        scopedProperties: auth.scopedProperties,
        isPropertiesLive: masterData.isPropertiesLive,
        refreshProperties: masterData.refreshProperties,
        addNewProperty: masterData.addNewProperty,
        vendors: masterData.vendors,
        isVendorsLive: masterData.isVendorsLive,
        refreshVendors: masterData.refreshVendors,
        addNewVendor: masterData.addNewVendor,
        propertyCategories: masterData.propertyCategories,
        vendorCategories: masterData.vendorCategories,
        paymentMethods: masterData.paymentMethods,
        mappings: masterData.mappings,
        isMappingsLive: masterData.isMappingsLive,
        refreshMappings: masterData.refreshMappings,
        toggleAutoApproval: masterData.toggleAutoApproval,
        updateMappingTerms: masterData.updateMappingTerms,
        addMapping: masterData.addMapping,
        companyPolicy: masterData.companyPolicy,
        updatePropertyPolicy: masterData.updatePropertyPolicy,
        updateCompanyPolicy: masterData.updateCompanyPolicy,
        evaluatePolicyForInvoice: masterData.evaluatePolicyForInvoice,

        // Invoices
        invoices: invoiceData.invoices,
        selectedInvoiceId: invoiceData.selectedInvoiceId,
        setSelectedInvoiceId: invoiceData.setSelectedInvoiceId,
        selectedInvoice: invoiceData.selectedInvoice,
        activities: invoiceData.activities,
        approveInvoice: invoiceData.approveInvoice,
        bulkApproveInvoices: invoiceData.bulkApproveInvoices,
        rejectInvoice: invoiceData.rejectInvoice,
        requestReevaluation: invoiceData.requestReevaluation,
        dismissDuplicate: invoiceData.dismissDuplicate,
        resolveException: invoiceData.resolveException,
        executeStripePayment: invoiceData.executeStripePayment,
        batchExecutePayments: invoiceData.batchExecutePayments,
        confirmMatch: invoiceData.confirmMatch,
        rerunExtraction: invoiceData.rerunExtraction,
        updateExtractedInvoice: invoiceData.updateExtractedInvoice,
        addNewInvoice: invoiceData.addNewInvoice,
      }}
    >
      {children}
    </InvoiceContext.Provider>
  );
};

export const useInvoiceStore = () => {
  const context = useContext(InvoiceContext);
  if (!context) {
    throw new Error('useInvoiceStore must be used within an InvoiceProvider');
  }
  return context;
};
