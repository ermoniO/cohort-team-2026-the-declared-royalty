import { useState, useEffect } from 'react';
import { Property, Vendor, PropertyVendorRelationship, PayerPolicy } from '../types';
import {
  INITIAL_PROPERTIES,
  INITIAL_VENDORS,
  INITIAL_PROPERTY_VENDOR_MAPPINGS,
  COMPANY_DEFAULT_POLICY,
} from '../data/mockData';
import { fetchUIProperties, createUIProperty } from '../app/services/propertyService';
import { CreatePropertyInput } from '../app/adapters/propertyAdapter';
import { fetchUIVendors, createUIVendor } from '../app/services/vendorService';
import { CreateVendorInput } from '../app/adapters/vendorAdapter';
import {
  fetchPropertyCategories,
  fetchVendorCategories,
  fetchPaymentMethods,
} from '../app/services/metadataService';
import type { PropertyCategoryResponse, VendorCategoryResponse, PaymentMethodResponse } from '@/types/api';

export function useMasterData() {
  const [properties, setProperties] = useState<Property[]>(INITIAL_PROPERTIES);
  const [isPropertiesLive, setIsPropertiesLive] = useState<boolean>(false);
  const [vendors, setVendors] = useState<Vendor[]>(INITIAL_VENDORS);
  const [isVendorsLive, setIsVendorsLive] = useState<boolean>(false);
  const [mappings, setMappings] = useState<PropertyVendorRelationship[]>(INITIAL_PROPERTY_VENDOR_MAPPINGS);
  const [companyPolicy, setCompanyPolicy] = useState<PayerPolicy>(COMPANY_DEFAULT_POLICY);

  // Dynamic Metadata
  const [propertyCategories, setPropertyCategories] = useState<PropertyCategoryResponse[]>([]);
  const [vendorCategories, setVendorCategories] = useState<VendorCategoryResponse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodResponse[]>([]);

  const refreshProperties = async () => {
    try {
      const liveProps = await fetchUIProperties(properties);
      if (liveProps && liveProps.length > 0) {
        setProperties(liveProps);
        setIsPropertiesLive(true);
      }
    } catch {
      setIsPropertiesLive(false);
    }
  };

  const refreshVendors = async () => {
    try {
      const liveVendors = await fetchUIVendors(vendors);
      if (liveVendors && liveVendors.length > 0) {
        setVendors(liveVendors);
        setIsVendorsLive(true);
      }
    } catch {
      setIsVendorsLive(false);
    }
  };

  const addNewProperty = async (input: CreatePropertyInput): Promise<Property> => {
    try {
      const created = await createUIProperty(input);
      setProperties((prev) => [created, ...prev]);
      return created;
    } catch {
      const fullAddress = [input.streetAddress, input.city, input.state, input.zipCode]
        .filter(Boolean)
        .join(', ');

      const localFallback: Property = {
        id: `prop-local-${Date.now()}`,
        name: input.name,
        address: fullAddress,
        propertyType: input.category || 'COMMERCIAL_OFFICE',
        managerName: 'Operations Manager',
        sqft: 200000,
        policy: { ...COMPANY_DEFAULT_POLICY },
        hasCustomPolicy: false,
      };
      setProperties((prev) => [localFallback, ...prev]);
      return localFallback;
    }
  };

  const addNewVendor = async (input: CreateVendorInput): Promise<Vendor> => {
    try {
      const created = await createUIVendor(input);
      setVendors((prev) => [created, ...prev]);
      return created;
    } catch {
      const localFallback: Vendor = {
        id: `vend-local-${Date.now()}`,
        name: input.name,
        category: input.category,
        accountNumber: `ACT-${Math.floor(100000 + Math.random() * 900000)}`,
        defaultPaymentMethod: input.defaultPaymentMethod,
        remittanceAddress: input.remittanceAddress || 'PO Box 1000, Commercial Suite, US',
        taxId: input.taxId,
        status: 'verified',
        historicalMatchesCount: 0,
        phoneNumber: input.phoneNumber,
        paymentUrl: input.paymentUrl,
      };
      setVendors((prev) => [localFallback, ...prev]);
      return localFallback;
    }
  };

  const updatePropertyPolicy = (propertyId: string, policyUpdates: Partial<PayerPolicy>) => {
    setProperties((prev) =>
      prev.map((prop) => {
        if (prop.id !== propertyId) return prop;
        return {
          ...prop,
          hasCustomPolicy: true,
          policy: { ...prop.policy, ...policyUpdates },
        };
      })
    );
  };

  const updateCompanyPolicy = (policyUpdates: Partial<PayerPolicy>) => {
    setCompanyPolicy((prev) => ({ ...prev, ...policyUpdates }));
  };

  const toggleAutoApproval = (mappingId: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.id === mappingId ? { ...m, autoApprovalEnabled: !m.autoApprovalEnabled } : m
      )
    );
  };

  const addMapping = (newMapping: Omit<PropertyVendorRelationship, 'id'>) => {
    const created: PropertyVendorRelationship = {
      ...newMapping,
      id: `pvm-${Date.now()}`,
    };
    setMappings((prev) => [created, ...prev]);
  };

  const evaluatePolicyForInvoice = (amount: number, propertyId: string, confidence: number) => {
    const prop = properties.find((p) => p.id === propertyId);
    const policy = prop?.hasCustomPolicy ? prop.policy : companyPolicy;
    const effectiveMaxAmount = policy.maxAutoApproveAmount;
    const minConfidence = policy.minConfidenceScore;

    if (confidence < minConfidence) {
      return {
        isAutoApproved: false,
        tier: amount > 10000 ? ('vp_finance' as const) : ('property_manager' as const),
        effectiveMaxAmount,
        requiresHumanReview: true,
        reason: `Confidence score (${confidence}%) is below minimum required (${minConfidence}%).`,
      };
    }

    if (amount <= effectiveMaxAmount) {
      return {
        isAutoApproved: true,
        tier: 'auto_approved' as const,
        effectiveMaxAmount,
        requiresHumanReview: false,
        reason: `Amount $${amount.toLocaleString()} is within automated policy limit of $${effectiveMaxAmount.toLocaleString()}.`,
      };
    }

    if (amount <= 10000) {
      return {
        isAutoApproved: false,
        tier: 'property_manager' as const,
        effectiveMaxAmount,
        requiresHumanReview: true,
        reason: `Amount $${amount.toLocaleString()} exceeds auto-approval limit ($${effectiveMaxAmount.toLocaleString()}). Requires Property Manager approval.`,
      };
    }

    return {
      isAutoApproved: false,
      tier: 'vp_finance' as const,
      effectiveMaxAmount,
      requiresHumanReview: true,
      reason: `Amount $${amount.toLocaleString()} exceeds executive limit ($10,000.00). Requires VP Finance approval.`,
    };
  };

  useEffect(() => {
    refreshProperties();
    refreshVendors();
    fetchPropertyCategories().then(setPropertyCategories);
    fetchVendorCategories().then(setVendorCategories);
    fetchPaymentMethods().then(setPaymentMethods);
  }, []);

  return {
    properties,
    isPropertiesLive,
    refreshProperties,
    addNewProperty,
    vendors,
    isVendorsLive,
    refreshVendors,
    addNewVendor,
    propertyCategories,
    vendorCategories,
    paymentMethods,
    mappings,
    toggleAutoApproval,
    addMapping,
    companyPolicy,
    updatePropertyPolicy,
    updateCompanyPolicy,
    evaluatePolicyForInvoice,
  };
}
