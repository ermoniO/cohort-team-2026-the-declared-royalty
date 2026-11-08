export type VendorStatus = 'ACTIVE' | 'INACTIVE';

export type PaymentMethod = string;

export type Vendor = {
  vendorId: string;
  name: string;
  category?: string;
  taxId?: string;
  phoneNumber?: string;
  status: VendorStatus;
  paymentUrl?: string;
  paymentMethod: PaymentMethod;
  createdAt?: string;
  updatedAt?: string;
};

export type VendorResponse = {
  vendorUuid: string;
  name: string;
  category?: string | null;
  taxId?: string | null;
  phoneNumber?: string | null;
  status: VendorStatus;
  paymentUrl?: string | null;
  paymentMethod: PaymentMethod;
  createdAt?: string;
  updatedAt?: string;
};

export type VendorCreateRequest = {
  name: string;
  category?: string;
  taxId?: string;
  phoneNumber?: string;
  status?: VendorStatus;
  paymentUrl?: string;
  paymentMethod?: PaymentMethod;
};

export type VendorUpdateRequest = Partial<VendorCreateRequest>;
