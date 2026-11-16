import React, { useState, useEffect } from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import {
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Edit2,
  Calculator,
  ArrowRight,
  Lock,
  X,
  Plus,
  UserCheck,
  Trash2,
  KeyRound,
  Shield,
  UserX,
  UserPlus,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import {
  getAccountsPayableSeats,
  getAccountsPayableThresholdPresets,
  assignSeatOccupant,
  vacateSeatOccupant,
  getPropertyApprovalMatrix,
  addPropertyApprovalMatrixStep,
  deletePropertyApprovalMatrixStep,
  getApprovalQueue
} from '../app/services/approvalMatrixService';
import { evaluatePropertyPolicy } from '../app/services/policyService';
import { getUsers } from '../app/services/userService';
import type { UserResponse } from '../types/user';
import type {
  AccountsPayableSeatResponse,
  AccountsPayableThresholdPresetResponse,
  PropertyApprovalMatrixResponse,
  ApprovalQueueResponse
} from '@/types/api';
import type { PolicyEvaluationResponse } from '../app/services/policyService';
import { NAVIGATION_SECTIONS } from '@/config/navigation';
import { UserAvatar } from '@/features/users/UserAvatar';
import { PageHeader } from './layout/PageHeader';
import { SelectDropdown } from './ui/SelectDropdown';

export const PayerPolicyRules: React.FC = () => {
  const {
    properties,
    isPropertiesLive,
    currentProfile,
  } = useInvoiceStore();

  const navConfig = NAVIGATION_SECTIONS.flatMap((s) => s.items).find(
    (item) => item.id === 'policies'
  );

  // Property context & Matrix state
  const [selectedPropContextId, setSelectedPropContextId] = useState<string>(properties[0]?.id || '');
  const [matrixSteps, setMatrixSteps] = useState<PropertyApprovalMatrixResponse[]>([]);
  const [seats, setSeats] = useState<AccountsPayableSeatResponse[]>([]);
  const [presets, setPresets] = useState<AccountsPayableThresholdPresetResponse[]>([]);
  const [systemUsers, setSystemUsers] = useState<UserResponse[]>([]);
  const [isLoadingMatrix, setIsLoadingMatrix] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Matrix Step Modal
  const [isStepModalOpen, setIsStepModalOpen] = useState(false);
  const [stepModalSequence, setStepModalSequence] = useState<number>(0);
  const [stepModalSeatSlug, setStepModalSeatSlug] = useState<string>('');
  const [stepModalThresholdSlug, setStepModalThresholdSlug] = useState<string>('');
  const [stepModalError, setStepModalError] = useState<string | null>(null);

  // Seat Assignment Modal
  const [isSeatAssignModalOpen, setIsSeatAssignModalOpen] = useState(false);
  const [assignSeatSlug, setAssignSeatSlug] = useState<string>('');
  const [assignUserUuid, setAssignUserUuid] = useState<string>('');
  const [seatAssignError, setSeatAssignError] = useState<string | null>(null);

  // Live Routing Simulation Tool
  const [simAmount, setSimAmount] = useState<number>(15000);
  const [simCostType, setSimCostType] = useState<'VARIABLE' | 'FIXED_MONTHLY'>('VARIABLE');
  const [simConfidence, setSimConfidence] = useState<number>(95);
  const [queuePreview, setQueuePreview] = useState<ApprovalQueueResponse | null>(null);
  const [policyEvaluation, setPolicyEvaluation] = useState<PolicyEvaluationResponse | null>(null);
  const [isSimulatingQueue, setIsSimulatingQueue] = useState(false);

  // Synchronize selected property context when properties list loads
  useEffect(() => {
    if (properties.length > 0 && (!selectedPropContextId || !properties.some((p) => p.id === selectedPropContextId))) {
      setSelectedPropContextId(properties[0].id);
    }
  }, [properties, selectedPropContextId]);

  // Load AP Metadata (Seats, Presets, Users)
  useEffect(() => {
    let isMounted = true;
    async function loadMetadata() {
      try {
        const [loadedSeats, loadedPresets, loadedUsers] = await Promise.all([
          getAccountsPayableSeats(),
          getAccountsPayableThresholdPresets(),
          getUsers(),
        ]);
        if (isMounted) {
          setSeats(loadedSeats ?? []);
          setPresets(loadedPresets ?? []);
          setSystemUsers(loadedUsers ?? []);
        }
      } catch (err) {
        console.warn('Failed to load accounts payable metadata:', err);
      }
    }
    loadMetadata();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load Matrix Steps for selected property
  const loadMatrix = async (propertyId: string) => {
    if (!propertyId) return;
    setIsLoadingMatrix(true);
    try {
      const data = await getPropertyApprovalMatrix(propertyId);
      setMatrixSteps(data ?? []);
    } catch (err) {
      console.warn('Failed to load approval matrix for property:', err);
      setMatrixSteps([]);
    } finally {
      setIsLoadingMatrix(false);
    }
  };

  useEffect(() => {
    if (selectedPropContextId) {
      loadMatrix(selectedPropContextId);
    }
  }, [selectedPropContextId]);

  // Live Queue Calculation Simulation
  useEffect(() => {
    let isMounted = true;
    async function runSim() {
      if (!selectedPropContextId || simAmount <= 0) return;
      setIsSimulatingQueue(true);
      try {
        const [queue, evalRes] = await Promise.all([
          getApprovalQueue(selectedPropContextId, simAmount, simCostType),
          evaluatePropertyPolicy(selectedPropContextId, {
            grossAmount: simAmount,
            costType: simCostType,
            confidenceScore: simConfidence,
          }).catch((err) => {
            console.warn('Live policy evaluation calculation error:', err);
            return null;
          }),
        ]);
        if (isMounted) {
          setQueuePreview(queue);
          setPolicyEvaluation(evalRes);
        }
      } catch (err) {
        console.warn('Live approval queue calculation error:', err);
      } finally {
        if (isMounted) setIsSimulatingQueue(false);
      }
    }
    runSim();
    return () => {
      isMounted = false;
    };
  }, [selectedPropContextId, simAmount, simCostType, simConfidence]);

  const canEdit = currentProfile.canEditPolicy;

  // Step Modal Handlers
  const handleOpenAddStep = (stepOrSeq?: PropertyApprovalMatrixResponse | number) => {
    if (typeof stepOrSeq === 'object' && stepOrSeq !== null) {
      setStepModalSequence(stepOrSeq.accountsPayableApprovalSequence);
      setStepModalSeatSlug(stepOrSeq.accountsPayableSeatSlug);
      setStepModalThresholdSlug(stepOrSeq.accountsPayableThresholdSlug);
    } else {
      const seq = typeof stepOrSeq === 'number' ? stepOrSeq : (matrixSteps.length < 6 ? matrixSteps.length : 0);
      setStepModalSequence(seq);
      setStepModalSeatSlug(seats[0]?.accountsPayableSeatSlug || '');
      setStepModalThresholdSlug(presets[0]?.accountsPayableThresholdSlug || '');
    }
    setStepModalError(null);
    setIsStepModalOpen(true);
  };

  const handleSaveStep = async () => {
    if (!selectedPropContextId || !stepModalSeatSlug || !stepModalThresholdSlug) {
      setStepModalError('Please specify seat and threshold preset.');
      return;
    }
    try {
      setStepModalError(null);
      await addPropertyApprovalMatrixStep(selectedPropContextId, {
        accountsPayableApprovalSequence: stepModalSequence,
        accountsPayableSeatSlug: stepModalSeatSlug,
        accountsPayableThresholdSlug: stepModalThresholdSlug,
      });
      setNotification({ type: 'success', message: `Approval sequence step #${stepModalSequence} committed.` });
      setIsStepModalOpen(false);
      loadMatrix(selectedPropContextId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save approval matrix step';
      setStepModalError(msg);
    }
  };

  const handleDeleteStep = async (sequence: number) => {
    if (!selectedPropContextId) return;
    if (sequence === 5) {
      setNotification({ type: 'error', message: 'Sequence Step 5 is the permanent fiduciary safety net and cannot be deleted.' });
      return;
    }
    try {
      await deletePropertyApprovalMatrixStep(selectedPropContextId, sequence);
      setNotification({ type: 'success', message: `Approval sequence step #${sequence} removed.` });
      loadMatrix(selectedPropContextId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove approval matrix step';
      setNotification({ type: 'error', message: msg });
    }
  };

  // Seat Assignment Handlers
  const handleOpenAssignSeat = (seatSlug: string) => {
    setAssignSeatSlug(seatSlug);
    setAssignUserUuid(systemUsers[0]?.userId || '');
    setSeatAssignError(null);
    setIsSeatAssignModalOpen(true);
  };

  const handleCommitSeatAssignment = async () => {
    if (!assignSeatSlug || !assignUserUuid) {
      setSeatAssignError('Please select an occupant user.');
      return;
    }
    try {
      setSeatAssignError(null);
      await assignSeatOccupant(assignSeatSlug, assignUserUuid);
      setNotification({ type: 'success', message: `Occupant assigned to ${assignSeatSlug}.` });
      setIsSeatAssignModalOpen(false);
      // Refresh metadata & matrix
      const updatedSeats = await getAccountsPayableSeats();
      setSeats(updatedSeats);
      if (selectedPropContextId) loadMatrix(selectedPropContextId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign occupant to seat';
      setSeatAssignError(msg);
    }
  };

  const handleVacateSeat = async (seatSlug: string) => {
    try {
      await vacateSeatOccupant(seatSlug);
      setNotification({ type: 'success', message: `Seat ${seatSlug} is now vacant.` });
      const updatedSeats = await getAccountsPayableSeats();
      setSeats(updatedSeats);
      if (selectedPropContextId) loadMatrix(selectedPropContextId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to vacate seat';
      setNotification({ type: 'error', message: msg });
    }
  };

  const currentPropertyObj = properties.find((p) => p.id === selectedPropContextId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={navConfig?.label || 'Approval Policies'}
        subtitle={
          navConfig?.subtitle ||
          'Sequential 0–5 escalation matrix, RBAC operational seats, and live invoice routing simulator'
        }
      >
        {!canEdit && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 text-xs">
            <Lock className="w-3.5 h-3.5" />
            <span>Policy edits restricted. Administrator or Property Manager role required.</span>
          </div>
        )}
      </PageHeader>

      {notification && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="font-bold hover:opacity-75">
            ×
          </button>
        </div>
      )}

      {/* SECTION 1: Single-File Property Approval Matrix Table (Steps 0–5) */}
      <div className="bg-white rounded-xl border border-[#e6ebe8] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#e6ebe8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#16834a]" />
              <h3 className="text-sm font-bold text-[#14532d]">
                Property Approval Matrix (Sequential Steps 0–5)
              </h3>
            </div>
            <p className="text-xs text-[#68766f] mt-0.5">
              Escalation sequence governing invoice sign-offs. Step 0 is intake floor; Step 5 is permanent unlimited safety net.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#68766f]">Property:</span>
              <SelectDropdown
                ariaLabel="Select property for approval matrix"
                value={selectedPropContextId}
                onChange={setSelectedPropContextId}
                className="min-w-[200px]"
                buttonClassName="py-1.5 px-2.5 bg-[#f8faf9] hover:bg-white"
                options={properties.map((p) => ({
                  value: p.id,
                  label: p.name,
                }))}
              />
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => handleOpenAddStep()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Step</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8faf9] text-[#68766f] border-b border-[#e6ebe8] font-semibold">
              <tr>
                <th className="px-4 py-3">Sequence Rank</th>
                <th className="px-4 py-3">Operational AP Seat</th>
                <th className="px-4 py-3">Current Occupant</th>
                <th className="px-4 py-3">Threshold Preset</th>
                <th className="px-4 py-3 text-right">Variable Max (T&amp;M)</th>
                <th className="px-4 py-3 text-right">Fixed Match Limit</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6ebe8] text-[#25362f]">
              {isLoadingMatrix ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#68766f]">
                    Loading property approval matrix...
                  </td>
                </tr>
              ) : matrixSteps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#68766f]">
                    <UserCheck className="w-8 h-8 text-[#98a29c] mx-auto mb-2" />
                    No approval steps configured for this property asset.
                  </td>
                </tr>
              ) : (
                matrixSteps.map((step) => {
                  const isStep5 = step.accountsPayableApprovalSequence === 5;
                  const isStep0 = step.accountsPayableApprovalSequence === 0;
                  const isVacant = !step.assignedUserName;

                  return (
                    <tr
                      key={step.accountsPayableApprovalSequence}
                      className={`hover:bg-[#f6fbf8] transition-colors ${
                        isStep5 ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[#f8faf9] text-[#14532d] border border-[#e6ebe8]">
                            #{step.accountsPayableApprovalSequence}
                          </span>
                          {isStep0 && (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#14532d] bg-[#e8f7ed] px-2 py-0.5 rounded border border-[#d7ebdd]">
                                <Sparkles className="w-2.5 h-2.5 text-[#16834a]" />
                                AI Auto-Approval &amp; Intake Floor
                              </span>
                              {step.accountsPayableThresholdSlug === 'LIMIT_NONE' || (step.variableMax === 0 && step.fixedAutoMax === 0) ? (
                                <span className="text-[10px] font-medium text-rose-600">
                                  AI Disabled (LIMIT_NONE: $0.00)
                                </span>
                              ) : (
                                <span className="text-[10px] text-[#68766f] font-medium">
                                  Ceiling: ${step.variableMax?.toLocaleString()} · (Set to LIMIT_NONE to disable AI)
                                </span>
                              )}
                            </div>
                          )}
                          {isStep5 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <Lock className="w-2.5 h-2.5" />
                              Safety Net
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#14532d]">
                          {step.seatDisplayName || step.accountsPayableSeatSlug}
                        </div>
                        <div className="text-[10px] font-mono text-[#68766f]">
                          {step.accountsPayableSeatSlug}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {isStep0 && isVacant ? (
                          <div className="flex items-center gap-2">
                            <UserAvatar name="System Automation" isSystem sizeClassName="size-7" />
                            <span className="text-[11px] font-semibold text-[#14532d]">
                              System Automation
                            </span>
                          </div>
                        ) : isVacant ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Vacant (Action Required)
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              userId={step.assignedUserUuid ?? undefined}
                              name={step.assignedUserName}
                              role={step.seatDisplayName || step.accountsPayableSeatSlug}
                              avatarUrl={
                                step.assignedUserAvatarUrl ??
                                systemUsers.find((u) => u.userId === step.assignedUserUuid)
                                  ?.avatarUrl
                              }
                              sizeClassName="size-7"
                            />
                            <div>
                              <div className="font-semibold text-[#14532d]">
                                {step.assignedUserName}
                              </div>
                              <div className="text-[10px] text-[#68766f]">
                                {step.assignedUserEmail}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-[#14532d] bg-[#e8f7ed] px-2 py-0.5 rounded border border-[#d7ebdd]">
                          {step.accountsPayableThresholdSlug}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono font-bold text-[#14532d] text-right tabular-nums">
                        {step.variableMax === -1 || step.variableMax === null || step.variableMax === undefined || step.variableMax >= 99999999 || step.accountsPayableThresholdSlug === 'LIMIT_UNLIMITED' ? (
                          <span className="text-[#16834a] font-bold">UNLIMITED</span>
                        ) : (
                          `$${step.variableMax.toLocaleString()}`
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-[#25362f] text-right tabular-nums">
                        {step.fixedAutoMax === -1 || step.fixedAutoMax === null || step.fixedAutoMax === undefined || step.fixedAutoMax >= 99999999 || step.accountsPayableThresholdSlug === 'LIMIT_UNLIMITED' ? (
                          <span className="text-[#16834a] font-bold">UNLIMITED</span>
                        ) : (
                          `$${step.fixedAutoMax.toLocaleString()}`
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {isStep5 ? (
                          <span className="text-[11px] text-[#98a29c] italic inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Locked Safety Net
                          </span>
                        ) : canEdit ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenAddStep(step)}
                              className="px-2 py-1 text-[#25362f] hover:text-[#14532d] hover:bg-[#e8f7ed] rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Edit step"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteStep(step.accountsPayableApprovalSequence)}
                              className="px-2 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Remove step"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[#98a29c] text-[11px]">View Only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Live Routing Simulation & Predictive Escalation Tool */}
      <div className="bg-white p-6 rounded-xl border border-[#e6ebe8] shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#16834a]" />
              <h3 className="text-sm font-bold text-[#14532d]">
                Live Invoice Routing Simulator
              </h3>
            </div>
            <p className="text-xs text-[#68766f] mt-0.5">
              Simulates the exact sequential escalation ladder for a hypothetical invoice using live property matrix rules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#68766f] mb-0.5">Gross Amount ($)</label>
              <input
                type="number"
                value={simAmount}
                onChange={(e) => setSimAmount(Number(e.target.value))}
                className="text-xs font-mono bg-[#f8faf9] text-[#14532d] border border-[#e6ebe8] rounded-lg py-1.5 px-3 w-32 focus:outline-none focus:border-[#16834a]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#68766f] mb-0.5">Cost Type</label>
              <SelectDropdown
                ariaLabel="Cost Type"
                value={simCostType}
                onChange={(val) => setSimCostType(val as 'VARIABLE' | 'FIXED_MONTHLY')}
                className="min-w-[210px]"
                buttonClassName="py-1.5 px-3 bg-[#f8faf9] hover:bg-white"
                options={[
                  { value: 'VARIABLE', label: 'VARIABLE (Time & Materials)' },
                  { value: 'FIXED_MONTHLY', label: 'FIXED_MONTHLY (Recurring)' },
                ]}
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#68766f] mb-0.5">OCR Confidence (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={simConfidence}
                onChange={(e) => setSimConfidence(Number(e.target.value))}
                className="text-xs font-mono bg-[#f8faf9] text-[#14532d] border border-[#e6ebe8] rounded-lg py-1.5 px-3 w-20 focus:outline-none focus:border-[#16834a]"
              />
            </div>
          </div>
        </div>

        {policyEvaluation && (
          <div className="mb-4 p-4 bg-[#f8faf9] rounded-lg border border-[#e6ebe8] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#68766f] font-semibold">Auto-Approval Decision:</span>
                {policyEvaluation.isAutoApproved ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[#e8f7ed] text-[#14532d] border border-[#d7ebdd]">
                    <Sparkles className="w-3.5 h-3.5 text-[#16834a]" />
                    Auto-Approved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    Human Review Required
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#68766f] font-semibold">Auto-Pay Eligibility:</span>
                {policyEvaluation.autoPayEligible ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#14532d] bg-[#e8f7ed] px-2 py-0.5 rounded border border-[#d7ebdd]">
                    <CheckCircle2 className="w-3 h-3 text-[#16834a]" />
                    Eligible for Instant Auto-Pay
                  </span>
                ) : (
                  <span className="text-xs font-medium text-[#68766f] bg-white px-2 py-0.5 rounded border border-[#e6ebe8]">
                    Manual Payment Release Required
                  </span>
                )}
              </div>
            </div>

            <div className="text-xs text-[#25362f] bg-white p-2.5 rounded border border-[#e6ebe8] flex items-start gap-2">
              <span className="font-semibold text-[#68766f] shrink-0">Decision Rationale:</span>
              <span>{policyEvaluation.reason}</span>
            </div>
          </div>
        )}

        {queuePreview && (
          <div className="space-y-4">
            {queuePreview.hasVacantStep && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Vacant Seat Warning:</strong> At least one required approver seat in this routing queue is vacant. An administrator must assign an occupant before invoices can pass this step.
                </span>
              </div>
            )}

            <div className="p-4 bg-[#f6fbf8] rounded-xl border border-[#d7ebdd]">
              <div className="text-xs text-[#68766f] font-semibold mb-3 flex items-center justify-between">
                <span>
                  Calculated Escalation Chain ({queuePreview.steps?.length || 0} Required Approvals):
                </span>
                <span>Context: {currentPropertyObj?.name}</span>
              </div>

              {queuePreview.steps && queuePreview.steps.length > 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  {queuePreview.steps.map((qStep, idx) => (
                    <React.Fragment key={qStep.sequence}>
                      <div className="p-3 bg-white border border-[#e6ebe8] rounded-lg flex flex-col min-w-48 shadow-2xs">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-mono text-[10px] font-semibold text-[#68766f]">
                            Step #{qStep.sequence}
                          </span>
                          {qStep.isProxy && (
                            <span className="text-[10px] font-semibold text-[#14532d] bg-[#e8f7ed] px-1.5 py-0.2 rounded border border-[#d7ebdd]">
                              Proxy Delegate
                            </span>
                          )}
                          {qStep.isVacant && (
                            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                              Vacant
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            userId={qStep.userUuid ?? undefined}
                            name={qStep.sequence === 0 ? 'System Automation' : qStep.userName || 'Vacant Seat'}
                            role={qStep.seatDisplayName || qStep.seatSlug}
                            avatarUrl={
                              qStep.userAvatarUrl ??
                              systemUsers.find((u) => u.userId === qStep.userUuid)?.avatarUrl
                            }
                            isSystem={qStep.sequence === 0}
                            sizeClassName="size-8"
                            highlightRing={!qStep.isVacant && idx === queuePreview.steps.length - 1}
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-[#14532d] truncate">
                              {qStep.seatDisplayName || qStep.seatSlug}
                            </div>
                            <div className="text-[11px] text-[#25362f] truncate">
                              {qStep.isVacant ? (
                                <span className="text-rose-600 italic">No occupant assigned</span>
                              ) : qStep.sequence === 0 ? (
                                'System Automation'
                              ) : (
                                qStep.userName
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-[10px] font-mono text-[#68766f] mt-2 pt-1.5 border-t border-[#e6ebe8]">
                          Cap: {simCostType === 'VARIABLE' ? `$${qStep.variableMax.toLocaleString()}` : `$${qStep.fixedAutoMax.toLocaleString()}`}
                        </div>
                      </div>

                      {idx < queuePreview.steps.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-[#16834a] shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[#68766f] italic">No routing steps triggered.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: Operational Seats & Occupant Directory Panel */}
      <div className="bg-white rounded-xl border border-[#e6ebe8] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#e6ebe8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#16834a]" />
              <h3 className="text-sm font-bold text-[#14532d]">
                Accounts Payable Seats &amp; Occupant Directory
              </h3>
            </div>
            <p className="text-xs text-[#68766f] mt-0.5">
              Decoupled RBAC seats. Seats hold signing authority; human occupants hold identities and delegation links.
            </p>
          </div>

          <div className="text-xs text-[#68766f] font-medium">
            {seats.filter((s) => s.assignedUserName).length} of {seats.length} seats occupied
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {seats.map((seat) => {
            const isOccupied = Boolean(seat.assignedUserName);

            return (
              <div
                key={seat.accountsPayableSeatSlug}
                className="p-4 rounded-xl border border-[#e6ebe8] bg-[#f8faf9] flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#14532d]">{seat.displayName}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isOccupied
                          ? 'bg-[#e8f7ed] text-[#14532d] border-[#d7ebdd]'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {isOccupied ? 'Occupied' : 'Vacant'}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-[#68766f] mt-0.5">
                    {seat.accountsPayableSeatSlug}
                  </div>

                  <div className="mt-3 p-2.5 bg-white rounded-lg border border-[#e6ebe8] text-xs">
                    {isOccupied ? (
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          userId={seat.assignedUserUuid ?? undefined}
                          name={seat.assignedUserName}
                          role={seat.displayName}
                          avatarUrl={
                            seat.assignedUserAvatarUrl ??
                            systemUsers.find((u) => u.userId === seat.assignedUserUuid)
                              ?.avatarUrl
                          }
                          sizeClassName="size-8"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-[#14532d] truncate">
                            {seat.assignedUserName}
                          </div>
                          <div className="text-[11px] text-[#68766f] truncate">
                            {seat.assignedUserEmail}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[#68766f] italic text-[11px]">
                        No human currently seated. Approval queue will trigger vacant warning.
                      </div>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="pt-2 border-t border-[#e6ebe8] flex items-center justify-end gap-2">
                    {isOccupied && (
                      <button
                        type="button"
                        onClick={() => handleVacateSeat(seat.accountsPayableSeatSlug)}
                        className="px-2.5 py-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <UserX className="w-3 h-3" />
                        <span>Vacate</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenAssignSeat(seat.accountsPayableSeatSlug)}
                      className="px-2.5 py-1 text-xs font-semibold text-[#14532d] bg-[#e8f7ed] hover:bg-[#d7ebdd] rounded-md border border-[#d7ebdd] transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3 text-[#16834a]" />
                      <span>{isOccupied ? 'Reassign' : 'Assign Occupant'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Step Modal (Standardized 540px) */}
      {isStepModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#25362f]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[540px] rounded-xl border border-[#e6ebe8] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e6ebe8] flex items-center justify-between bg-[#f8faf9]">
              <div>
                <h3 className="text-sm font-bold text-[#14532d]">
                  Configure Approval Matrix Step #{stepModalSequence}
                </h3>
                <p className="text-xs text-[#68766f] mt-0.5">
                  Link an operational seat and a threshold preset to this sequence level
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsStepModalOpen(false)}
                className="p-1 rounded text-[#68766f] hover:text-[#14532d] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {stepModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{stepModalError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#25362f] mb-1">
                  Sequence Rank (0 = Intake Floor, 5 = Safety Net)
                </label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={stepModalSequence}
                  onChange={(e) => setStepModalSequence(Number(e.target.value))}
                  disabled={stepModalSequence === 5}
                  className="w-full py-2 px-3 border border-[#e6ebe8] rounded-lg font-mono disabled:bg-[#f8faf9]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#25362f] mb-1">
                  Operational AP Seat
                </label>
                <SelectDropdown
                  ariaLabel="Operational AP Seat"
                  value={stepModalSeatSlug}
                  onChange={setStepModalSeatSlug}
                  options={seats.map((s) => ({
                    value: s.accountsPayableSeatSlug,
                    label: `${s.displayName} (${s.accountsPayableSeatSlug})`,
                  }))}
                />
              </div>

              <div>
                <label className="block font-semibold text-[#25362f] mb-1">
                  Threshold Preset
                </label>
                <SelectDropdown
                  ariaLabel="Threshold Preset"
                  value={stepModalThresholdSlug}
                  onChange={setStepModalThresholdSlug}
                  options={presets.map((pr) => ({
                    value: pr.accountsPayableThresholdSlug,
                    label: `${pr.accountsPayableThresholdSlug} (Variable: $${pr.variableMax === -1 ? 'UNLIMITED' : pr.variableMax.toLocaleString()} / Fixed: $${pr.fixedAutoMax === -1 ? 'UNLIMITED' : pr.fixedAutoMax.toLocaleString()})`,
                  }))}
                />
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsStepModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#68766f] hover:text-[#14532d] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStep}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#16834a] rounded-lg hover:bg-[#13723f] transition-colors shadow-xs cursor-pointer"
              >
                Save Matrix Step
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seat Occupant Assignment Modal (Standardized 540px) */}
      {isSeatAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#25362f]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[540px] rounded-xl border border-[#e6ebe8] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e6ebe8] flex items-center justify-between bg-[#f8faf9]">
              <div>
                <h3 className="text-sm font-bold text-[#14532d]">
                  Assign Occupant to Seat
                </h3>
                <p className="text-xs text-[#68766f] mt-0.5">
                  Target Seat: <span className="font-mono font-semibold text-[#16834a]">{assignSeatSlug}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsSeatAssignModalOpen(false)}
                className="p-1 rounded text-[#68766f] hover:text-[#14532d] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {seatAssignError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{seatAssignError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#25362f] mb-1">
                  Select Corporate Human Operative
                </label>
                <SelectDropdown
                  ariaLabel="Select Corporate Human Operative"
                  value={assignUserUuid}
                  onChange={setAssignUserUuid}
                  options={systemUsers.map((u) => ({
                    value: u.userId,
                    label: `${u.username} (${u.email})`,
                  }))}
                />
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsSeatAssignModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#68766f] hover:text-[#14532d] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitSeatAssignment}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#16834a] rounded-lg hover:bg-[#13723f] transition-colors shadow-xs cursor-pointer"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
