export type PropertyStatus = 'ACTIVE' | 'INACTIVE';

export interface AddressDTO {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
}

export type Property = {
  propertyId: string;
  name: string;
  category: string;
  address: AddressDTO;
  status: PropertyStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type PropertyCreateRequest = {
  name: string;
  category: string;
  address: AddressDTO;
};

export type PropertyResponse = {
  propertyId: string;
  name: string;
  category: string;
  address: AddressDTO;
  status: PropertyStatus;
  createdAt?: string;
  updatedAt?: string;
};
