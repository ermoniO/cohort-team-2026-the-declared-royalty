export type VendorStatus = "ACTIVE" | "INACTIVE";

export type PaymentMethod =
  | "ACH"
  | "CHECK"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "WIRE_TRANSFER"
  | "OTHER";

export type Vendor = {
  vendorId?: string;
  vendorUuid: string;
  name: string;
  phoneNumber?: string | null;
  status: VendorStatus;
  paymentUrl?: string | null;
  paymentMethod: PaymentMethod;
  createdAt: string;
  updatedAt: string;
};

export type VendorResponse = Vendor;

export type VendorCreateRequest = {
  name: string;
  phoneNumber?: string;
  status?: VendorStatus;
  paymentUrl?: string;
  paymentMethod?: PaymentMethod;
};

export type VendorUpdateRequest = {
  name?: string;
  phoneNumber?: string;
  status?: VendorStatus;
  paymentUrl?: string;
  paymentMethod?: PaymentMethod;
};
