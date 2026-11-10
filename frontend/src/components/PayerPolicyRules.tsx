import React, { useState, useEffect } from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import { Property } from '../types';
import {
  SlidersHorizontal,
  Building2,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Edit2,
  Check,
  Calculator,
  ArrowRight,
  Lock,
  X,
  Plus,
  UserCheck,
  Trash2,
  KeyRound,
  Shield,
  Layers,
  UserX,
  UserPlus,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { CreatePropertyModal } from './CreatePropertyModal';
import {
  getCorporateDesignations,
  getAccountsPayableSeats,
  getAccountsPayableThresholdPresets,
  assignSeatOccupant,
  vacateSeatOccupant,
  getPropertyApprovalMatrix,
  addPropertyApprovalMatrixStep,
  updatePropertyApprovalMatrixStep,
  deletePropertyApprovalMatrixStep,
  getApprovalQueue
} from '../app/services/approvalMatrixService';
import { getUsers } from '../app/services/userService';
import type { UserResponse } from '../types/user';
import type {
  CorporateDesignationResponse,
  AccountsPayableSeatResponse,
  AccountsPayableThresholdPresetResponse,
  AccountsPayableApprovalMatrixResponse,
  PropertyApprovalMatrixResponse,
  ApprovalQueueResponse
} from '@/types/api';
import {
  MOCK_AP_SEATS,
  MOCK_THRESHOLD_PRESETS,
  MOCK_PROPERTY_APPROVAL_MATRIX_STEPS,
  MOCK_USERS
} from '../data/mockData';

export const PayerPolicyRules: React.FC = () => {
  const {
    properties,
    isPropertiesLive,
    companyPolicy,
    updateCompanyPolicy,
    updatePropertyPolicy,
    evaluatePolicyForInvoice,
    currentProfile,
    addNewProperty,
  } = useInvoiceStore();

  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editingCompanyPolicy, setEditingCompanyPolicy] = useState(false);

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
  const [queuePreview, setQueuePreview] = useState<ApprovalQueueResponse | null>(null);
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
        const fallbackUsers: UserResponse[] = MOCK_USERS.map((u) => ({
          userId: u.id,
          username: u.name,
          email: u.email,
          status: u.status,
          createdAt: '',
          updatedAt: '',
        }));
        const [loadedSeats, loadedPresets, loadedUsers] = await Promise.all([
          getAccountsPayableSeats().catch(() => MOCK_AP_SEATS),
          getAccountsPayableThresholdPresets().catch(() => MOCK_THRESHOLD_PRESETS),
          getUsers().catch(() => fallbackUsers),
        ]);
        if (isMounted) {
          setSeats(loadedSeats && loadedSeats.length > 0 ? loadedSeats : MOCK_AP_SEATS);
          setPresets(loadedPresets && loadedPresets.length > 0 ? loadedPresets : MOCK_THRESHOLD_PRESETS);
          setSystemUsers(loadedUsers && loadedUsers.length > 0 ? loadedUsers : fallbackUsers);
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
      setMatrixSteps(data && data.length > 0 ? data : MOCK_PROPERTY_APPROVAL_MATRIX_STEPS);
    } catch {
      setMatrixSteps(MOCK_PROPERTY_APPROVAL_MATRIX_STEPS);
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
        const queue = await getApprovalQueue(selectedPropContextId, simAmount, simCostType);
        if (isMounted) {
          setQueuePreview(queue);
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
  }, [selectedPropContextId, simAmount, simCostType]);

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

  // Company Policy Baseline Handlers
  const [companyAutoApprove, setCompanyAutoApprove] = useState(companyPolicy.maxAutoApproveAmount);
  const [companyAutoPay, setCompanyAutoPay] = useState(companyPolicy.maxAutoPayAmount);
  const [companyMinConfidence, setCompanyMinConfidence] = useState(companyPolicy.minConfidenceScore);

  const handleSaveCompanyPolicy = () => {
    updateCompanyPolicy({
      maxAutoApproveAmount: companyAutoApprove,
      maxAutoPayAmount: companyAutoPay,
      minConfidenceScore: companyMinConfidence,
    });
    setEditingCompanyPolicy(false);
  };

  // Property Overrides
  const [propAutoApprove, setPropAutoApprove] = useState(1500);
  const [propAutoPay, setPropAutoPay] = useState(500);
  const [propMinConfidence, setPropMinConfidence] = useState(85);
  const [propRequiresPo, setPropRequiresPo] = useState(false);
  const [propAutoPayEnabled, setPropAutoPayEnabled] = useState(true);

  const handleOpenEditProp = (prop: Property) => {
    setEditingProperty(prop);
    setPropAutoApprove(prop.policy.maxAutoApproveAmount);
    setPropAutoPay(prop.policy.maxAutoPayAmount);
    setPropMinConfidence(prop.policy.minConfidenceScore);
    setPropRequiresPo(prop.policy.requiresPoMatch);
    setPropAutoPayEnabled(prop.policy.autoPayEnabled);
  };

  const handleSavePropertyPolicy = () => {
    if (!editingProperty) return;
    updatePropertyPolicy(editingProperty.id, {
      maxAutoApproveAmount: propAutoApprove,
      maxAutoPayAmount: propAutoPay,
      minConfidenceScore: propMinConfidence,
      requiresPoMatch: propRequiresPo,
      autoPayEnabled: propAutoPayEnabled,
    });
    setEditingProperty(null);
  };

  const currentPropertyObj = properties.find((p) => p.id === selectedPropContextId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
            Payer Policy & Multi-Tier Approval Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Sequential 0–5 escalation matrix, RBAC operational seats, proxy delegation, and fiduciary guardrails per property
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-white shadow-2xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isPropertiesLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span className="text-slate-600">
              {isPropertiesLive ? 'Backend API Connected' : 'Local Mock Data'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsAddPropertyOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Property</span>
          </button>

          {!canEdit && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 rounded-md border border-amber-200 text-xs">
              <Lock className="w-3.5 h-3.5" />
              <span>Policy edits restricted. Administrator or Property Manager role required.</span>
            </div>
          )}
        </div>
      </div>

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
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Property Approval Matrix (Sequential Steps 0–5)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Escalation sequence governing invoice sign-offs. Step 0 is intake floor; Step 5 is permanent unlimited safety net.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Property:</span>
              <select
                value={selectedPropContextId}
                onChange={(e) => setSelectedPropContextId(e.target.value)}
                className="text-xs bg-slate-50 text-slate-900 border border-slate-300 rounded-md py-1.5 px-2.5 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {canEdit && (
              <button
                onClick={() => handleOpenAddStep()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs transition-colors inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Step</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
              <tr>
                <th className="px-4 py-3">Sequence Rank</th>
                <th className="px-4 py-3">Operational AP Seat</th>
                <th className="px-4 py-3">Current Occupant</th>
                <th className="px-4 py-3">Threshold Preset</th>
                <th className="px-4 py-3 text-right">Variable Max (T&M)</th>
                <th className="px-4 py-3 text-right">Fixed Match Limit</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {isLoadingMatrix ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Loading property approval matrix...
                  </td>
                </tr>
              ) : matrixSteps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No approval steps configured for this property asset.
                  </td>
                </tr>
              ) : (
                matrixSteps.map((step) => {
                  const isStep5 = step.accountsPayableApprovalSequence === 5;
                  const isVacant = !step.assignedUserName;

                  return (
                    <tr
                      key={step.accountsPayableApprovalSequence}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isStep5 ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                            #{step.accountsPayableApprovalSequence}
                          </span>
                          {step.accountsPayableApprovalSequence === 0 && (
                            <span className="text-[10px] text-slate-500 font-medium">Intake Floor</span>
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
                        <div className="font-semibold text-slate-900">
                          {step.seatDisplayName || step.accountsPayableSeatSlug}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {step.accountsPayableSeatSlug}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {isVacant ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Vacant (Action Required)
                          </span>
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-900">
                              {step.assignedUserName}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {step.assignedUserEmail}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {step.accountsPayableThresholdSlug}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono font-bold text-slate-900 text-right tabular-nums">
                        {step.variableMax === -1 || step.variableMax === null || step.variableMax === undefined || step.variableMax >= 99999999 || step.accountsPayableThresholdSlug === 'LIMIT_UNLIMITED' ? (
                          <span className="text-indigo-600 font-bold">UNLIMITED</span>
                        ) : (
                          `$${step.variableMax.toLocaleString()}`
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-slate-700 text-right tabular-nums">
                        {step.fixedAutoMax === -1 || step.fixedAutoMax === null || step.fixedAutoMax === undefined || step.fixedAutoMax >= 99999999 || step.accountsPayableThresholdSlug === 'LIMIT_UNLIMITED' ? (
                          <span className="text-indigo-600 font-bold">UNLIMITED</span>
                        ) : (
                          `$${step.fixedAutoMax.toLocaleString()}`
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {isStep5 ? (
                          <span className="text-[11px] text-slate-400 italic inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Locked Safety Net
                          </span>
                        ) : canEdit ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenAddStep(step)}
                              className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors inline-flex items-center gap-1"
                              title="Edit step"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteStep(step.accountsPayableApprovalSequence)}
                              className="px-2 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors inline-flex items-center gap-1"
                              title="Remove step"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">View Only</span>
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
      <div className="bg-slate-900 text-white p-6 rounded-lg border border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">
                Live Invoice Routing Preview Tool
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulates the exact sequential escalation ladder for a hypothetical invoice using live property matrix rules.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 mb-0.5">Gross Amount ($)</label>
              <input
                type="number"
                value={simAmount}
                onChange={(e) => setSimAmount(Number(e.target.value))}
                className="text-xs font-mono bg-slate-800 text-white border border-slate-700 rounded py-1.5 px-3 w-32 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 mb-0.5">Cost Type</label>
              <select
                value={simCostType}
                onChange={(e) => setSimCostType(e.target.value as 'VARIABLE' | 'FIXED_MONTHLY')}
                className="text-xs bg-slate-800 text-white border border-slate-700 rounded py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="VARIABLE">VARIABLE (Time & Materials)</option>
                <option value="FIXED_MONTHLY">FIXED_MONTHLY (Recurring)</option>
              </select>
            </div>
          </div>
        </div>

        {queuePreview && (
          <div className="space-y-4">
            {queuePreview.hasVacantStep && (
              <div className="p-3 bg-amber-950/80 border border-amber-800 rounded-md text-amber-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Vacant Seat Warning:</strong> At least one required approver seat in this routing queue is vacant. An administrator must assign an occupant before bills can pass this step.
                </span>
              </div>
            )}

            <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700">
              <div className="text-xs text-slate-400 font-semibold mb-3 flex items-center justify-between">
                <span>Calculated Escalation Chain ({queuePreview.steps?.length || 0} Required Approvals):</span>
                <span>Context: {currentPropertyObj?.name}</span>
              </div>

              {queuePreview.steps && queuePreview.steps.length > 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  {queuePreview.steps.map((qStep, idx) => (
                    <React.Fragment key={qStep.sequence}>
                      <div className="p-3 bg-slate-900 border border-slate-700 rounded-md flex flex-col min-w-44 shadow-2xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-[10px] text-slate-400">Step #{qStep.sequence}</span>
                          {qStep.isProxy && (
                            <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-950 px-1.5 py-0.2 rounded border border-indigo-800">
                              Proxy Delegate
                            </span>
                          )}
                          {qStep.isVacant && (
                            <span className="text-[10px] font-semibold text-rose-300 bg-rose-950 px-1.5 py-0.2 rounded border border-rose-800">
                              Vacant
                            </span>
                          )}
                        </div>

                        <div className="font-bold text-xs text-white">
                          {qStep.seatDisplayName || qStep.seatSlug}
                        </div>

                        <div className="text-[11px] text-slate-300 mt-1">
                          {qStep.isVacant ? (
                            <span className="text-rose-400 italic">No occupant assigned</span>
                          ) : (
                            <span>{qStep.userName}</span>
                          )}
                        </div>

                        <div className="text-[10px] font-mono text-slate-500 mt-1">
                          Cap: {simCostType === 'VARIABLE' ? `$${qStep.variableMax.toLocaleString()}` : `$${qStep.fixedAutoMax.toLocaleString()}`}
                        </div>
                      </div>

                      {idx < queuePreview.steps.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">No routing steps triggered.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: Operational Seats & Occupant Directory Panel */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Accounts Payable Seats & Occupant Directory
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Decoupled RBAC seats. Seats hold signing authority; human occupants hold identities and delegation links.
            </p>
          </div>

          <div className="text-xs text-slate-500">
            {seats.filter((s) => s.assignedUserName).length} of {seats.length} seats occupied
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {seats.map((seat) => {
            const isOccupied = Boolean(seat.assignedUserName);

            return (
              <div
                key={seat.accountsPayableSeatSlug}
                className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{seat.displayName}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isOccupied
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {isOccupied ? 'Occupied' : 'Vacant'}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    {seat.accountsPayableSeatSlug}
                  </div>

                  <div className="mt-3 p-2.5 bg-white rounded border border-slate-200 text-xs">
                    {isOccupied ? (
                      <div>
                        <div className="font-semibold text-slate-900">{seat.assignedUserName}</div>
                        <div className="text-[11px] text-slate-500">{seat.assignedUserEmail}</div>
                      </div>
                    ) : (
                      <div className="text-slate-400 italic text-[11px]">
                        No human currently seated. Approval queue will trigger vacant warning.
                      </div>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                    {isOccupied && (
                      <button
                        onClick={() => handleVacateSeat(seat.accountsPayableSeatSlug)}
                        className="px-2.5 py-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors inline-flex items-center gap-1"
                      >
                        <UserX className="w-3 h-3" />
                        <span>Vacate</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenAssignSeat(seat.accountsPayableSeatSlug)}
                      className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded border border-indigo-200 transition-colors inline-flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>{isOccupied ? 'Reassign' : 'Assign Occupant'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 4: Portfolio Property Baseline & Property Policies */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Baseline Card */}
        <div className="lg:col-span-6 bg-white p-6 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Portfolio Default Baseline Policy
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Applied to properties without custom policy overrides
                </p>
              </div>

              {canEdit && (
                <button
                  onClick={() => setEditingCompanyPolicy(!editingCompanyPolicy)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>{editingCompanyPolicy ? 'Cancel' : 'Edit Baseline'}</span>
                </button>
              )}
            </div>

            {editingCompanyPolicy ? (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Dollar Limit for AI Auto-Approval
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
                    <input
                      type="number"
                      value={companyAutoApprove}
                      onChange={(e) => setCompanyAutoApprove(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-1.5 text-xs font-mono border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Dollar Limit for AI Auto-Pay Disbursement
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
                    <input
                      type="number"
                      value={companyAutoPay}
                      onChange={(e) => setCompanyAutoPay(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-1.5 text-xs font-mono border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Minimum AI Confidence Score Required (%)
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="99"
                    value={companyMinConfidence}
                    onChange={(e) => setCompanyMinConfidence(Number(e.target.value))}
                    className="w-full accent-slate-900"
                  />
                  <div className="flex justify-between text-xs text-slate-500 font-mono mt-1">
                    <span>50%</span>
                    <span className="font-bold text-slate-900">{companyMinConfidence}%</span>
                    <span>99%</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSaveCompanyPolicy}
                    className="w-full py-2 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
                  >
                    Save Baseline Policy
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <span className="text-[11px] text-slate-500 block font-medium">Auto-Approve Cap</span>
                  <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                    ${companyPolicy.maxAutoApproveAmount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-emerald-600 block mt-1">Auto routes if matched</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <span className="text-[11px] text-slate-500 block font-medium">Auto-Pay Cap</span>
                  <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                    ${companyPolicy.maxAutoPayAmount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">Direct card charge</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <span className="text-[11px] text-slate-500 block font-medium">Min Confidence</span>
                  <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                    {companyPolicy.minConfidenceScore}%
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">Threshold gate</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between mt-4">
            <span>Enforced across all commercial accounts payable transactions.</span>
          </div>
        </div>

        {/* Property Policy Overrides Overview */}
        <div className="lg:col-span-6 bg-white p-6 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Property Asset Custom Configurations
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Commercial properties configured with localized override rules
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {properties.map((p) => (
                <div
                  key={p.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900">{p.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Cap: ${p.policy.maxAutoApproveAmount.toLocaleString()} · Min Conf: {p.policy.minConfidenceScore}%
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => handleOpenEditProp(p)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-300 transition-colors inline-flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Configure</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between mt-4">
            <span>Property-level overrides take precedence over portfolio baselines.</span>
          </div>
        </div>
      </div>

      {/* Add / Edit Step Modal */}
      {isStepModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Configure Approval Matrix Step #{stepModalSequence}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Link an operational seat and a threshold preset to this sequence level
                </p>
              </div>

              <button
                onClick={() => setIsStepModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {stepModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{stepModalError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Sequence Rank (0 = Intake Floor, 5 = Safety Net)
                </label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={stepModalSequence}
                  onChange={(e) => setStepModalSequence(Number(e.target.value))}
                  disabled={stepModalSequence === 5}
                  className="w-full py-1.5 px-3 border border-slate-300 rounded font-mono disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Operational AP Seat
                </label>
                <select
                  value={stepModalSeatSlug}
                  onChange={(e) => setStepModalSeatSlug(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded bg-white font-medium"
                >
                  {seats.map((s) => (
                    <option key={s.accountsPayableSeatSlug} value={s.accountsPayableSeatSlug}>
                      {s.displayName} ({s.accountsPayableSeatSlug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Threshold Preset
                </label>
                <select
                  value={stepModalThresholdSlug}
                  onChange={(e) => setStepModalThresholdSlug(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded bg-white font-medium"
                >
                  {presets.map((pr) => (
                    <option key={pr.accountsPayableThresholdSlug} value={pr.accountsPayableThresholdSlug}>
                      {pr.accountsPayableThresholdSlug} (Variable: ${pr.variableMax === -1 ? 'UNLIMITED' : pr.variableMax.toLocaleString()} / Fixed: ${pr.fixedAutoMax === -1 ? 'UNLIMITED' : pr.fixedAutoMax.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsStepModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStep}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors shadow-xs"
              >
                Save Matrix Step
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seat Occupant Assignment Modal */}
      {isSeatAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Assign Occupant to Seat
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target Seat: <span className="font-mono font-semibold text-indigo-700">{assignSeatSlug}</span>
                </p>
              </div>

              <button
                onClick={() => setIsSeatAssignModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {seatAssignError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{seatAssignError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Corporate Human Operative
                </label>
                <select
                  value={assignUserUuid}
                  onChange={(e) => setAssignUserUuid(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded bg-white font-medium"
                >
                  {systemUsers.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.username} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsSeatAssignModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCommitSeatAssignment}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors shadow-xs"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Property Policy Edit Modal */}
      {editingProperty && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Configure Payer Policy: {editingProperty.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set property-specific dollar thresholds and automation criteria
                </p>
              </div>

              <button
                onClick={() => setEditingProperty(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Maximum Dollar Threshold for AI Auto-Approval ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    value={propAutoApprove}
                    onChange={(e) => setPropAutoApprove(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-1.5 font-mono border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Maximum Dollar Limit for AI Auto-Pay Disbursement ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    value={propAutoPay}
                    onChange={(e) => setPropAutoPay(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-1.5 font-mono border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Minimum AI OCR & Match Confidence Required ({propMinConfidence}%)
                </label>
                <input
                  type="range"
                  min="60"
                  max="99"
                  value={propMinConfidence}
                  onChange={(e) => setPropMinConfidence(Number(e.target.value))}
                  className="w-full accent-slate-900"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={propAutoPayEnabled}
                    onChange={(e) => setPropAutoPayEnabled(e.target.checked)}
                    className="rounded text-slate-900 accent-slate-900"
                  />
                  <span className="font-semibold text-slate-800">Enable Automated Stripe Test CC Payment</span>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingProperty(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePropertyPolicy}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors shadow-xs"
              >
                Save Property Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Property Modal */}
      <CreatePropertyModal
        isOpen={isAddPropertyOpen}
        onClose={() => setIsAddPropertyOpen(false)}
        onSubmit={addNewProperty}
      />
    </div>
  );
};
