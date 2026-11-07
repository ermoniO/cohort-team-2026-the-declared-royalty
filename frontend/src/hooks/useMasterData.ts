import { useState, useEffect } from 'react';
import { Property, Vendor, PropertyVendorRelationship, PayerPolicy } from '../types';
import {
  INITIAL_PROPERTIES,
  INITIAL_VENDORS,
  INITIAL_PROPERTY_VENDOR_MAPPINGS,
  COMPANY_DEFAULT_POLICY,
} from '../data/mockData';
import { fetchUIProperties } from '../app/services/propertyService';
import { fetchUIVendors } from '../app/services/vendorService';

export function useMasterData() {
  const [properties, setProperties] = useState<Property[]>(INITIAL_PROPERTIES);
  const [isPropertiesLive, setIsPropertiesLive] = useState<boolean>(false);
  const [vendors, setVendors] = useState<Vendor[]>(INITIAL_VENDORS);
  const [isVendorsLive, setIsVendorsLive] = useState<boolean>(false);
  const [mappings, setMappings] = useState<PropertyVendorRelationship[]>(INITIAL_PROPERTY_VENDOR_MAPPINGS);
  const [companyPolicy, setCompanyPolicy] = useState<PayerPolicy>(COMPANY_DEFAULT_POLICY);

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
  }, []);

  return {
    properties,
    isPropertiesLive,
    refreshProperties,
    vendors,
    isVendorsLive,
    refreshVendors,
    mappings,
    toggleAutoApproval,
    addMapping,
    companyPolicy,
    updatePropertyPolicy,
    updateCompanyPolicy,
    evaluatePolicyForInvoice,
  };
}

