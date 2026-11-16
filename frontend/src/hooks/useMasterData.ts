import { useState, useEffect } from 'react';
import { Property, Vendor, PropertyVendorRelationship, PayerPolicy } from '../types';
import { DEFAULT_PAYER_POLICY } from '../config/roles';
import { fetchUIProperties, createUIProperty } from '../app/services/propertyService';
import { CreatePropertyInput } from '../app/adapters/propertyAdapter';
import { fetchUIVendors, createUIVendor } from '../app/services/vendorService';
import { CreateVendorInput } from '../app/adapters/vendorAdapter';
import {
  fetchPropertyCategories,
  fetchVendorCategories,
  fetchPaymentMethods,
} from '../app/services/metadataService';
import {
  fetchUIMappings,
  createUIMapping,
  updateUIMapping,
} from '../app/services/propertyVendorMappingService';
import type { PropertyCategoryResponse, VendorCategoryResponse, PaymentMethodResponse } from '@/types/api';

export function useMasterData() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isPropertiesLive, setIsPropertiesLive] = useState<boolean>(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isVendorsLive, setIsVendorsLive] = useState<boolean>(false);
  const [mappings, setMappings] = useState<PropertyVendorRelationship[]>([]);
  const [isMappingsLive, setIsMappingsLive] = useState<boolean>(false);
  const [companyPolicy, setCompanyPolicy] = useState<PayerPolicy>(DEFAULT_PAYER_POLICY);

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

  const refreshMappings = async () => {
    try {
      const liveMappings = await fetchUIMappings();
      setMappings(liveMappings);
      setIsMappingsLive(true);
    } catch (err) {
      console.error('Failed to fetch mappings from backend:', err);
      setIsMappingsLive(false);
    }
  };

  const addNewProperty = async (input: CreatePropertyInput): Promise<Property> => {
    const created = await createUIProperty(input);
    setProperties((prev) => [created, ...prev]);
    return created;
  };

  const addNewVendor = async (input: CreateVendorInput): Promise<Vendor> => {
    const created = await createUIVendor(input);
    setVendors((prev) => [created, ...prev]);
    return created;
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

  const toggleAutoApproval = async (mappingId: string) => {
    const existing = mappings.find((m) => m.id === mappingId);
    if (!existing) return;
    const nextValue = !existing.autoApprovalEnabled;

    setMappings((prev) =>
      prev.map((m) => (m.id === mappingId ? { ...m, autoApprovalEnabled: nextValue } : m))
    );

    try {
      const updated = await updateUIMapping(mappingId, { autoApprovalEnabled: nextValue });
      setMappings((prev) => prev.map((m) => (m.id === mappingId ? updated : m)));
    } catch (err) {
      console.error('Failed to update auto-approval mapping:', err);
      setMappings((prev) =>
        prev.map((m) => (m.id === mappingId ? { ...m, autoApprovalEnabled: existing.autoApprovalEnabled } : m))
      );
    }
  };

  const updateMappingTerms = async (
    mappingId: string,
    updates: { costType: 'FIXED_MONTHLY' | 'VARIABLE'; defaultGlCode?: string; status?: 'ACTIVE' | 'INACTIVE' }
  ) => {
    const existing = mappings.find((m) => m.id === mappingId);
    setMappings((prev) =>
      prev.map((m) => (m.id === mappingId ? { ...m, ...updates } : m))
    );

    try {
      const updated = await updateUIMapping(mappingId, {
        costType: updates.costType,
        defaultGlCode: updates.defaultGlCode ?? null,
        ...(updates.status ? { status: updates.status } : {}),
      });
      setMappings((prev) => prev.map((m) => (m.id === mappingId ? updated : m)));
    } catch (err) {
      console.error('Failed to update mapping terms:', err);
      if (existing) {
        setMappings((prev) => prev.map((m) => (m.id === mappingId ? existing : m)));
      }
    }
  };

  const addMapping = async (
    newMapping: Omit<PropertyVendorRelationship, 'id' | 'propertyName' | 'vendorName'> & {
      propertyName?: string;
      vendorName?: string;
    }
  ): Promise<PropertyVendorRelationship> => {
    const prop = properties.find((p) => p.id === newMapping.propertyId);
    const vend = vendors.find((v) => v.id === newMapping.vendorId);

    const created = await createUIMapping({
      propertyUuid: newMapping.propertyId,
      vendorUuid: newMapping.vendorId,
      vendorAccountNumber: newMapping.vendorAccountNumber,
      costType: newMapping.costType ?? 'VARIABLE',
      defaultGlCode: newMapping.defaultGlCode ?? null,
      autoApprovalEnabled: newMapping.autoApprovalEnabled,
      status: newMapping.status ?? 'ACTIVE',
    });
    const enriched: PropertyVendorRelationship = {
      ...created,
      propertyName: created.propertyName || newMapping.propertyName || prop?.name || '',
      vendorName: created.vendorName || newMapping.vendorName || vend?.name || '',
    };
    setMappings((prev) => [enriched, ...prev]);
    return enriched;
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
    refreshMappings();
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
    isMappingsLive,
    refreshMappings,
    toggleAutoApproval,
    updateMappingTerms,
    addMapping,
    companyPolicy,
    updatePropertyPolicy,
    updateCompanyPolicy,
    evaluatePolicyForInvoice,
  };
}
