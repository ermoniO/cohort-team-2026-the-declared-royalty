import type { Property, Vendor } from "@/types";

export type PropertyVendorMapping = {
    mappingId: string,
    vendor: Vendor,
    property: Property,
    vendorAccountNumber: string,
    status: string,
    autoApprovalEnabled: boolean,
    createdAt: string,
    updatedAt: string,
};
