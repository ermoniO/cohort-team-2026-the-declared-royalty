import { describe, expect, it } from 'vitest';
import { resolveInvoiceClearingSummary } from '@/components/ApprovalsQueue';
import type { ApprovalQueueStepResponse } from '@/types/api';

const USER_ELENA = '00000000-0000-0000-0000-000000000010';
const USER_MARCUS = '00000000-0000-0000-0000-000000000011';
const USER_SARAH = '00000000-0000-0000-0000-000000000012';
const USER_DAVID = '00000000-0000-0000-0000-000000000013';

function makeStep(
  overrides: Partial<ApprovalQueueStepResponse>
): ApprovalQueueStepResponse {
  return {
    sequence: 1,
    seatSlug: 'PM_SEAT_FRISCO_OFFICE',
    seatDisplayName: 'Frisco Commercial Complex PM Seat',
    userUuid: USER_MARCUS,
    userName: 'Marcus Vance',
    userEmail: 'm.vance@pmfirm.com',
    isProxy: false,
    isVacant: false,
    thresholdSlug: 'LIMIT_LOW',
    variableMax: 1000,
    fixedAutoMax: 2500,
    ...overrides,
  };
}

describe('resolveInvoiceClearingSummary', () => {
  it('routes low-value variable invoice to PM seat and blocks Accountant (audit/under-limit)', () => {
    const steps: ApprovalQueueStepResponse[] = [
      makeStep({
        sequence: 0,
        seatSlug: 'CORP_HQ_ACCOUNTANT_01',
        seatDisplayName: 'HQ Senior Accountant - Seat 1',
        userUuid: USER_ELENA,
        userName: 'Elena Rostova',
        thresholdSlug: 'LIMIT_NONE',
        variableMax: 0,
        fixedAutoMax: 0,
      }),
      makeStep({
        sequence: 1,
        seatSlug: 'PM_SEAT_FRISCO_OFFICE',
        seatDisplayName: 'Frisco Commercial Complex PM Seat',
        userUuid: USER_MARCUS,
        userName: 'Marcus Vance',
        thresholdSlug: 'LIMIT_LOW',
        variableMax: 1000,
        fixedAutoMax: 2500,
      }),
    ];

    const pmView = resolveInvoiceClearingSummary(steps, USER_MARCUS, 2500, 324.16, 'VARIABLE');
    expect(pmView.requiredSeatSlug).toBe('PM_SEAT_FRISCO_OFFICE');
    expect(pmView.requiredSeatLabel).toBe('Frisco Commercial Complex PM Seat');
    expect(pmView.assignedApproverName).toBe('Marcus Vance');
    expect(pmView.canCurrentUserApprove).toBe(true);

    const seniorOverrideView = resolveInvoiceClearingSummary(steps, USER_SARAH, 10000, 324.16, 'VARIABLE');
    expect(seniorOverrideView.canCurrentUserApprove).toBe(true);

    const auditorView = resolveInvoiceClearingSummary(steps, 'auditor-id', 0, 324.16, 'VARIABLE');
    expect(auditorView.canCurrentUserApprove).toBe(false);
  });

  it('escalates $4,500 variable invoice to Step 2 Senior PM and blocks Step 1 PM even on $2.5k role limit', () => {
    const steps: ApprovalQueueStepResponse[] = [
      makeStep({
        sequence: 1,
        seatSlug: 'PM_SEAT_FRISCO_OFFICE',
        seatDisplayName: 'Frisco Commercial Complex PM Seat',
        userUuid: USER_MARCUS,
        userName: 'Marcus Vance',
        thresholdSlug: 'LIMIT_LOW',
        variableMax: 1000,
        fixedAutoMax: 2500,
      }),
      makeStep({
        sequence: 2,
        seatSlug: 'SPM_SEAT_DOWNTOWN',
        seatDisplayName: 'Downtown Flagship Senior PM Seat',
        userUuid: USER_SARAH,
        userName: 'Sarah Jenkins',
        thresholdSlug: 'LIMIT_MID',
        variableMax: 5000,
        fixedAutoMax: 10000,
      }),
    ];

    const pmBlocked = resolveInvoiceClearingSummary(steps, USER_MARCUS, 2500, 4500, 'VARIABLE');
    expect(pmBlocked.requiredSeatSlug).toBe('SPM_SEAT_DOWNTOWN');
    expect(pmBlocked.assignedApproverName).toBe('Sarah Jenkins');
    expect(pmBlocked.canCurrentUserApprove).toBe(false);

    // Even a $1,800 variable invoice is above Marcus's Step 1 variableMax ($1,000)
    const pmVariableBlocked = resolveInvoiceClearingSummary(steps, USER_MARCUS, 2500, 1800, 'VARIABLE');
    expect(pmVariableBlocked.canCurrentUserApprove).toBe(false);

    const seniorApproved = resolveInvoiceClearingSummary(steps, USER_SARAH, 10000, 4500, 'VARIABLE');
    expect(seniorApproved.canCurrentUserApprove).toBe(true);
  });

  it('surfaces delegated proxy and vacant seat flags accurately', () => {
    const proxySteps: ApprovalQueueStepResponse[] = [
      makeStep({
        sequence: 2,
        seatSlug: 'SPM_SEAT_DOWNTOWN',
        seatDisplayName: 'Downtown Flagship Senior PM Seat',
        userUuid: USER_DAVID,
        userName: 'David Sterling',
        isProxy: true,
        isVacant: false,
        thresholdSlug: 'LIMIT_MID',
        variableMax: 5000,
        fixedAutoMax: 10000,
      }),
    ];

    const proxySummary = resolveInvoiceClearingSummary(proxySteps, USER_DAVID, 50000, 4500, 'VARIABLE');
    expect(proxySummary.isProxy).toBe(true);
    expect(proxySummary.isVacant).toBe(false);
    expect(proxySummary.assignedApproverName).toBe('David Sterling');
    expect(proxySummary.canCurrentUserApprove).toBe(true);

    const vacantSteps: ApprovalQueueStepResponse[] = [
      makeStep({
        sequence: 1,
        seatSlug: 'PM_SEAT_FRISCO_OFFICE',
        seatDisplayName: 'Frisco Commercial Complex PM Seat',
        userUuid: null,
        userName: 'VACANT: Frisco Commercial Complex PM Seat',
        isProxy: false,
        isVacant: true,
        thresholdSlug: 'LIMIT_LOW',
      }),
    ];

    const vacantSummary = resolveInvoiceClearingSummary(vacantSteps, USER_SARAH, 10000, 324.16, 'VARIABLE');
    expect(vacantSummary.isVacant).toBe(true);
    expect(vacantSummary.assignedApproverName).toContain('VACANT');
  });
});

