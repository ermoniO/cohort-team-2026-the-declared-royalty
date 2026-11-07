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
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  propertyFilter: string;
  setPropertyFilter: (p: string) => void;

  // Master Data
  properties: Property[];
  scopedProperties: Property[];
  isPropertiesLive: boolean;
  refreshProperties: () => Promise<void>;
  vendors: Vendor[];
  isVendorsLive: boolean;
  refreshVendors: () => Promise<void>;
  mappings: PropertyVendorRelationship[];
  toggleAutoApproval: (mappingId: string) => void;
  addMapping: (mapping: Omit<PropertyVendorRelationship, 'id'>) => void;
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
  approveInvoice: (invoiceId: string, note?: string) => boolean;
  rejectInvoice: (invoiceId: string, reason: string) => void;
  requestReevaluation: (invoiceId: string, reason: string) => void;
  dismissDuplicate: (invoiceId: string, reason: string) => void;
  resolveException: (invoiceId: string, actionNote: string, newVendorId?: string) => void;
  executeStripePayment: (
    invoiceId: string,
    testCardType?: 'success' | 'decline' | 'insufficient'
  ) => Promise<{ success: boolean; message: string; chargeId?: string }>;
  batchExecutePayments: (invoiceIds: string[]) => Promise<{ processed: number; succeeded: number }>;
  confirmMatch: (invoiceId: string, vendorId: string, propertyId: string) => void;
  rerunExtraction: (invoiceId: string) => void;
  updateExtractedInvoice: (invoiceId: string, updates: Partial<Invoice>) => void;
  addNewInvoice: (newInvoiceData: Partial<Invoice>) => string;
}

const InvoiceContext = createContext<InvoiceContextType | undefined>(undefined);

export const InvoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation & Global Filters
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');

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
    evaluatePolicyForInvoice: masterData.evaluatePolicyForInvoice,
  });

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
        activeTab,
        setActiveTab,
        searchQuery,
        setSearchQuery,
        propertyFilter,
        setPropertyFilter,

        // Master Data
        properties: masterData.properties,
        scopedProperties: auth.scopedProperties,
        isPropertiesLive: masterData.isPropertiesLive,
        refreshProperties: masterData.refreshProperties,
        vendors: masterData.vendors,
        isVendorsLive: masterData.isVendorsLive,
        refreshVendors: masterData.refreshVendors,
        mappings: masterData.mappings,
        toggleAutoApproval: masterData.toggleAutoApproval,
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
