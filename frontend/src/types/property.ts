export type PropertyTypeDTO =
  | 'COMMERCIAL_OFFICE'
  | 'RETAIL_PLAZA'
  | 'INDUSTRIAL_PARK'
  | 'MEDICAL_CENTER';

export interface AddressDTO {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
}

export type Property = {
  propertyId: string;
  name: string;
  propertyType: PropertyTypeDTO;
  address: AddressDTO;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PropertyCreateRequest = {
  name: string;
  propertyType: PropertyTypeDTO;
  address: AddressDTO;
};

export type PropertyResponse = {
  propertyId: string;
  name: string;
  propertyType: PropertyTypeDTO;
  address: AddressDTO;
  status: string;
};
