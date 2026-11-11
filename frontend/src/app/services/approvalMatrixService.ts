import type {
  CorporateDesignationResponse,
  AccountsPayableSeatResponse,
  AccountsPayableThresholdPresetResponse,
  SeatAssignmentResponse,
  AccountsPayableApprovalMatrixResponse,
  PropertyApprovalMatrixResponse,
  AccountsPayableApprovalMatrixStepRequest,
  PropertyApprovalMatrixStepRequest,
  ApprovalQueueResponse,
} from '@/types/api';
import { apiClient } from './apiClient';

export async function getCorporateDesignations(): Promise<CorporateDesignationResponse[]> {
  const { data, error } = await apiClient.GET('/api/v1/corporate-designations');
  if (error || !data) return [];
  return data;
}

export async function getAccountsPayableSeats(): Promise<AccountsPayableSeatResponse[]> {
  const { data, error } = await apiClient.GET('/api/v1/accounts-payable-seats');
  if (error || !data) return [];
  return data;
}

export async function getAccountsPayableThresholdPresets(): Promise<
  AccountsPayableThresholdPresetResponse[]
> {
  const { data, error } = await apiClient.GET('/api/v1/accounts-payable-threshold-presets');
  if (error || !data) return [];
  return data;
}

export async function assignSeatOccupant(
  seatSlug: string,
  userUuid: string
): Promise<SeatAssignmentResponse> {
  const { data, error } = await apiClient.PUT(
    '/api/v1/accounts-payable-seats/{seatSlug}/assignment',
    {
      params: { path: { seatSlug } },
      body: { userUuid },
    }
  );
  if (error || !data) {
    const serverMsg = (error as { message?: string })?.message;
    throw new Error(serverMsg || 'Failed to assign seat occupant');
  }
  return data;
}

export async function vacateSeat(seatSlug: string): Promise<void> {
  const { error } = await apiClient.DELETE(
    '/api/v1/accounts-payable-seats/{seatSlug}/assignment',
    {
      params: { path: { seatSlug } },
    }
  );
  if (error) {
    const serverMsg = (error as { message?: string })?.message;
    throw new Error(serverMsg || 'Failed to vacate seat');
  }
}

export async function getPropertyApprovalMatrix(
  propertyId: string
): Promise<AccountsPayableApprovalMatrixResponse[]> {
  const { data, error } = await apiClient.GET(
    '/api/v1/properties/{propertyId}/approval-matrix',
    {
      params: { path: { propertyId } },
    }
  );
  if (error || !data) return [];
  return data;
}

export async function createMatrixStep(
  propertyId: string,
  request: AccountsPayableApprovalMatrixStepRequest
): Promise<AccountsPayableApprovalMatrixResponse> {
  const { data, error } = await apiClient.POST(
    '/api/v1/properties/{propertyId}/approval-matrix',
    {
      params: { path: { propertyId } },
      body: request,
    }
  );
  if (error || !data) {
    const serverMsg = (error as { message?: string })?.message;
    throw new Error(serverMsg || 'Failed to create approval matrix step');
  }
  return data;
}

export async function updateMatrixStep(
  propertyId: string,
  sequence: number,
  request: AccountsPayableApprovalMatrixStepRequest
): Promise<AccountsPayableApprovalMatrixResponse> {
  const { data, error } = await apiClient.PUT(
    '/api/v1/properties/{propertyId}/approval-matrix/{sequence}',
    {
      params: { path: { propertyId, sequence } },
      body: request,
    }
  );
  if (error || !data) {
    const serverMsg = (error as { message?: string })?.message;
    throw new Error(serverMsg || 'Failed to update approval matrix step');
  }
  return data;
}

export async function deleteMatrixStep(
  propertyId: string,
  sequence: number
): Promise<void> {
  const { error } = await apiClient.DELETE(
    '/api/v1/properties/{propertyId}/approval-matrix/{sequence}',
    {
      params: { path: { propertyId, sequence } },
    }
  );
  if (error) {
    const serverMsg = (error as { message?: string })?.message;
    throw new Error(serverMsg || 'Failed to delete approval matrix step');
  }
}

export const vacateSeatOccupant = vacateSeat;
export const addPropertyApprovalMatrixStep = createMatrixStep;
export const updatePropertyApprovalMatrixStep = updateMatrixStep;
export const deletePropertyApprovalMatrixStep = deleteMatrixStep;

export const getAccountsPayableApprovalMatrix = getPropertyApprovalMatrix;
export const addAccountsPayableApprovalMatrixStep = createMatrixStep;
export const updateAccountsPayableApprovalMatrixStep = updateMatrixStep;
export const deleteAccountsPayableApprovalMatrixStep = deleteMatrixStep;

export async function getApprovalQueue(
  propertyId: string,
  grossAmount: number,
  costType: string = 'VARIABLE'
): Promise<ApprovalQueueResponse> {

  const { data, error } = await apiClient.GET(
    '/api/v1/properties/{propertyId}/approval-queue',
    {
      params: {
        path: { propertyId },
        query: { grossAmount, costType },
      },
    }
  );
  if (error || !data) {
    const serverMsg = (error as { message?: string })?.message;
    throw new Error(serverMsg || 'Failed to calculate approval queue');
  }
  return data;
}
