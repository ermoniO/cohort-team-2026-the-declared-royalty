import type { components, paths } from './api.generated';

export type { paths, components };
export type Schema<T extends keyof components['schemas']> = components['schemas'][T];

// Primary API DTO Aliases
export type PropertyResponse = Schema<'PropertyResponse'>;
export type PropertyCreateRequest = Schema<'PropertyCreateRequest'>;
export type PropertyCategoryResponse = Schema<'PropertyCategoryResponse'>;
export type PropertyGlAccountResponse = Schema<'PropertyGlAccountResponse'>;

export type VendorResponse = Schema<'VendorResponse'>;
export type VendorCreateRequest = Schema<'VendorCreateRequest'>;
export type VendorUpdateRequest = Schema<'VendorUpdateRequest'>;
export type VendorCategoryResponse = Schema<'VendorCategoryResponse'>;
export type PaymentMethodResponse = Schema<'PaymentMethodResponse'>;

export type CorporateDesignationResponse = Schema<'CorporateDesignationResponse'>;
export type AccountsPayableSeatResponse = Schema<'AccountsPayableSeatResponse'>;
export type AccountsPayableThresholdPresetResponse = Schema<'AccountsPayableThresholdPresetResponse'>;
export type SeatAssignmentRequest = Schema<'SeatAssignmentRequest'>;
export type SeatAssignmentResponse = Schema<'SeatAssignmentResponse'>;
export type AccountsPayableApprovalMatrixResponse = Schema<'AccountsPayableApprovalMatrixResponse'>;
export type PropertyApprovalMatrixResponse = AccountsPayableApprovalMatrixResponse;
export type AccountsPayableApprovalMatrixStepRequest = Schema<'AccountsPayableApprovalMatrixStepRequest'>;
export type PropertyApprovalMatrixStepRequest = AccountsPayableApprovalMatrixStepRequest;
export type ApprovalQueueStepResponse = Schema<'ApprovalQueueStepResponse'>;
export type ApprovalQueueResponse = Schema<'ApprovalQueueResponse'>;
