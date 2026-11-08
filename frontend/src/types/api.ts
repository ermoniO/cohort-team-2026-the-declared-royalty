import type { components, paths } from './api.generated';

export type { paths, components };
export type Schema<T extends keyof components['schemas']> = components['schemas'][T];

// Primary API DTO Aliases
export type PropertyResponse = Schema<'PropertyResponse'>;
export type PropertyCreateRequest = Schema<'PropertyCreateRequest'>;
export type PropertyCategoryResponse = Schema<'PropertyCategoryResponse'>;

export type VendorResponse = Schema<'VendorResponse'>;
export type VendorCreateRequest = Schema<'VendorCreateRequest'>;
export type VendorUpdateRequest = Schema<'VendorUpdateRequest'>;
export type VendorCategoryResponse = Schema<'VendorCategoryResponse'>;
export type PaymentMethodResponse = Schema<'PaymentMethodResponse'>;

