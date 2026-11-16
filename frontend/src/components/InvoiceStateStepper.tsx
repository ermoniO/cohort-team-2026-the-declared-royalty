import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  FileSearch,
  GitCompare,
  Landmark,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { UserAvatar } from '@/features/users/UserAvatar';
import { getInitials, SYSTEM_ACTOR_ID } from '@/features/users/userDisplay';
import type { Invoice } from '@/types';
import type { AuditLogsResponse } from '@/types/auditlogs';
import type { InvoiceStatus as BackendInvoiceStatus } from '@/types/invoice';

export type MacroStageKey = 'capture' | 'validation' | 'approval' | 'settlement';

export type StageVisualStatus = 'completed' | 'active' | 'upcoming' | 'failed' | 'voided';

export type CompliancePillKind = 'auto' | 'manual' | 'pending' | 'fault';

export interface CompliancePill {
  label: string;
  kind: CompliancePillKind;
}

export interface StepperActorAvatar {
  id: string;
  name: string;
  initials: string;
  role: string;
  avatarUrl?: string | null;
  actionLabel: string;
  timestamp: string;
  isSystem: boolean;
  colorClass: string;
}

export interface MacroStageModel {
  key: MacroStageKey;
  index: number;
  title: string;
  subtitle: string;
  status: StageVisualStatus;
  pill: CompliancePill | null;
  actors: StepperActorAvatar[];
  failureDetail?: string;
}

export interface StepperModel {
  effectiveStatus: BackendInvoiceStatus;
  stages: MacroStageModel[];
  completedHops: number;
  faultStageIndex: number | null;
  failureReason?: string;
}

export type ActorLookup = (userUuid: string) => { name: string; role: string | null; avatarUrl?: string | null };

export interface ExpectedApproverInfo {
  id?: string;
  name: string;
  role?: string;
  avatarUrl?: string;
}

export interface InvoiceStateStepperProps {
  invoice: Invoice;
  auditLogs?: AuditLogsResponse[];
  actorFor?: ActorLookup;
  expectedApprover?: ExpectedApproverInfo | null;
  isTransitioning?: boolean;
  onStageClick?: (stageKey: MacroStageKey, stage: MacroStageModel) => void;
  compact?: boolean;
}

const STAGE_DEFINITIONS: Array<{
  key: MacroStageKey;
  index: number;
  title: string;
  subtitle: string;
}> = [
  { key: 'capture', index: 0, title: '1. Capture', subtitle: 'PDF Intake & OCR' },
  { key: 'validation', index: 1, title: '2. Validation & Match', subtitle: 'Property-Vendor Mapping' },
  { key: 'approval', index: 2, title: '3. Approval', subtitle: 'Policy & Sign-Off' },
  { key: 'settlement', index: 3, title: '4. Settlement', subtitle: 'Stripe Disbursement' },
];

export function resolveBackendStatus(invoice: Invoice): BackendInvoiceStatus {
  if (invoice.backendStatus) return invoice.backendStatus;
  switch (invoice.status) {
    case 'intake':
      return 'INGESTED';
    case 'extracted':
      return 'PENDING_MAPPING';
    case 'matched':
    case 'pending_approval':
      return 'PENDING_APPROVAL';
    case 'approved':
      return 'APPROVED';
    case 'paid':
      return 'PAID';
    case 'exception':
      return 'FAILED';
    default:
      return 'INGESTED';
  }
}

function stateToStageIndex(state?: string | null): number | null {
  switch (state) {
    case 'INGESTED':
      return 0;
    case 'PENDING_MAPPING':
      return 1;
    case 'PENDING_APPROVAL':
    case 'APPROVED':
      return 2;
    case 'PROCESSING_PAYMENT':
    case 'PAID':
      return 3;
    default:
      return null;
  }
}

function actionToStageIndex(actionType: string, fromState?: string): number {
  const upper = actionType.toUpperCase();
  if (upper.includes('INGESTED') || upper.includes('IDENTIFIED')) return 0;
  if (upper.includes('MATCHED') || upper.includes('VALIDATED')) return 1;
  if (upper.includes('APPROVED')) return 2;
  if (upper.includes('PAID')) return 3;
  const fromIdx = stateToStageIndex(fromState);
  if (fromIdx !== null) return fromIdx;
  return 2;
}

function formatAuditTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveFaultStageIndex(
  invoice: Invoice,
  auditLogs: AuditLogsResponse[],
  effectiveStatus: BackendInvoiceStatus,
): number {
  const faultLog = [...auditLogs]
    .reverse()
    .find((log) => log.toState === effectiveStatus || log.toState === 'FAILED' || log.toState === 'VOID');
  if (faultLog) {
    const idx = stateToStageIndex(faultLog.fromState);
    if (idx !== null) return idx;
  }
  if (!invoice.mappingId && !invoice.vendorId) return 1;
  if (invoice.paymentInfo?.status === 'failed' || invoice.paymentInfo?.status === 'declined') return 3;
  if (invoice.exception?.type === 'payment_failed') return 3;
  if (invoice.exception?.type === 'unknown_vendor') return 1;
  return 2;
}

export function deriveStepperModel(
  invoice: Invoice,
  auditLogs: AuditLogsResponse[] = [],
  actorFor?: ActorLookup,
): StepperModel {
  const effectiveStatus = resolveBackendStatus(invoice);
  const isFault = effectiveStatus === 'FAILED' || effectiveStatus === 'VOID';
  const faultStageIndex = isFault
    ? resolveFaultStageIndex(invoice, auditLogs, effectiveStatus)
    : null;

  let completedHops = 0;
  if (faultStageIndex !== null) {
    completedHops = faultStageIndex;
  } else {
    switch (effectiveStatus) {
      case 'INGESTED':
        completedHops = 0;
        break;
      case 'PENDING_MAPPING':
        completedHops = 1;
        break;
      case 'PENDING_APPROVAL':
        completedHops = 2;
        break;
      case 'APPROVED':
      case 'PROCESSING_PAYMENT':
      case 'PAID':
        completedHops = 3;
        break;
    }
  }

  // Group actors per macro-stage from auditLogs, with local auditTrail fallback
  const actorsByStage: StepperActorAvatar[][] = [[], [], [], []];
  const stageActions: string[][] = [[], [], [], []];

  const sortedLogs = [...auditLogs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  for (const log of sortedLogs) {
    const stageIdx = actionToStageIndex(log.actionType, log.fromState);
    stageActions[stageIdx].push(log.actionType);

    const isSystem =
      log.user === SYSTEM_ACTOR_ID || String(log.actionType).startsWith('SYSTEM_');
    const resolved = actorFor
      ? actorFor(log.user)
      : {
          name: isSystem ? 'System' : `User ${log.user.slice(0, 8)}`,
          role: isSystem ? 'Automated Engine' : 'AP Reviewer',
        };
    const name = resolved.name || (isSystem ? 'System' : 'AP Reviewer');
    const role = resolved.role || (isSystem ? 'Automated Engine' : 'AP Staff');

    const candidate: StepperActorAvatar = {
      id: log.user,
      name,
      initials: isSystem ? 'AI' : getInitials(name),
      role,
      avatarUrl: resolved.avatarUrl ?? null,
      actionLabel: log.actionTaken || String(log.actionType).replace(/_/g, ' '),
      timestamp: formatAuditTime(log.createdAt),
      isSystem,
      colorClass: isSystem ? 'bg-[#14532d] text-[#e8f7ed]' : 'bg-[#e8f7ed] text-[#14532d]',
    };

    const existingIdx = actorsByStage[stageIdx].findIndex(
      (a) => a.name === candidate.name && a.isSystem === candidate.isSystem,
    );
    if (existingIdx >= 0) {
      actorsByStage[stageIdx][existingIdx] = candidate;
    } else {
      actorsByStage[stageIdx].push(candidate);
    }
  }

  if (sortedLogs.length === 0 && Array.isArray(invoice.auditTrail)) {
    for (const evt of invoice.auditTrail) {
      const evtUpper = evt.eventType.toUpperCase();
      let stageIdx = 0;
      if (evtUpper.includes('MATCH')) stageIdx = 1;
      else if (evtUpper.includes('APPROV') || evtUpper.includes('REJECT') || evtUpper.includes('EXCEPTION')) stageIdx = 2;
      else if (evtUpper.includes('PAY')) stageIdx = 3;

      const isSystem =
        evt.user.toLowerCase().includes('system') ||
        evt.user.toLowerCase().includes('ai') ||
        evtUpper.includes('AUTO');
      stageActions[stageIdx].push(isSystem ? 'SYSTEM_EVENT' : 'USER_EVENT');

      const candidate: StepperActorAvatar = {
        id: evt.id,
        name: evt.user,
        initials: isSystem ? 'AI' : getInitials(evt.user),
        role: evt.role || (isSystem ? 'Automated Engine' : 'AP Reviewer'),
        actionLabel: evt.eventType.replace(/_/g, ' '),
        timestamp: evt.timestamp,
        isSystem,
        colorClass: isSystem ? 'bg-[#14532d] text-[#e8f7ed]' : 'bg-[#e8f7ed] text-[#14532d]',
      };

      if (!actorsByStage[stageIdx].some((a) => a.name === candidate.name)) {
        actorsByStage[stageIdx].push(candidate);
      }
    }
  }

  const failureReason =
    invoice.failureReason ||
    invoice.exception?.message ||
    invoice.paymentInfo?.failureReason ||
    undefined;

  const stages: MacroStageModel[] = STAGE_DEFINITIONS.map((def) => {
    let status: StageVisualStatus = 'upcoming';

    if (faultStageIndex !== null) {
      if (def.index < faultStageIndex) status = 'completed';
      else if (def.index === faultStageIndex) status = effectiveStatus === 'VOID' ? 'voided' : 'failed';
      else status = 'upcoming';
    } else {
      switch (effectiveStatus) {
        case 'INGESTED':
          status = def.index === 0 ? 'active' : 'upcoming';
          break;
        case 'PENDING_MAPPING':
          status = def.index === 0 ? 'completed' : def.index === 1 ? 'active' : 'upcoming';
          break;
        case 'PENDING_APPROVAL':
          status = def.index < 2 ? 'completed' : def.index === 2 ? 'active' : 'upcoming';
          break;
        case 'APPROVED':
        case 'PROCESSING_PAYMENT':
          status = def.index < 3 ? 'completed' : 'active';
          break;
        case 'PAID':
          status = 'completed';
          break;
      }
    }

    const actions = stageActions[def.index];
    const hasSystemAction = actions.some((a) => a.startsWith('SYSTEM_'));
    const hasUserAction = actions.some((a) => a.startsWith('USER_'));

    let pill: CompliancePill | null = null;
    if (status === 'failed') {
      pill = { label: 'Halted / Exception', kind: 'fault' };
    } else if (status === 'voided') {
      pill = { label: 'Voided', kind: 'fault' };
    } else if (def.index === 0) {
      if (hasUserAction && !hasSystemAction) {
        pill = { label: 'Manual Intake', kind: 'manual' };
      } else if (status === 'completed' || hasSystemAction) {
        pill = { label: 'Auto-Ingested', kind: 'auto' };
      } else {
        pill = { label: 'Queued Intake', kind: 'pending' };
      }
    } else if (def.index === 1) {
      if (actions.includes('SYSTEM_MATCHED') || (status === 'completed' && !hasUserAction && actions.length === 0)) {
        pill = { label: 'Auto-Matched', kind: 'auto' };
      } else if (hasUserAction || status === 'completed') {
        pill = { label: 'Mapped Pair', kind: 'manual' };
      } else if (status === 'active') {
        pill = { label: 'Needs Mapping', kind: 'pending' };
      }
    } else if (def.index === 2) {
      if (
        actions.includes('SYSTEM_APPROVED') ||
        (status === 'completed' && invoice.approvalTier === 'auto_approved' && !hasUserAction)
      ) {
        pill = { label: 'Auto-Approved', kind: 'auto' };
      } else if (status === 'completed') {
        pill = { label: 'Human Approved', kind: 'manual' };
      } else if (status === 'active') {
        pill = { label: 'Awaiting Sign-Off', kind: 'pending' };
      }
    } else if (def.index === 3) {
      if (actions.includes('SYSTEM_PAID')) {
        pill = { label: 'Auto-Paid', kind: 'auto' };
      } else if (status === 'completed') {
        pill = { label: 'Stripe Settled', kind: 'manual' };
      } else if (status === 'active') {
        pill = {
          label: effectiveStatus === 'PROCESSING_PAYMENT' ? 'Payment In Flight' : 'Ready to Pay',
          kind: 'pending',
        };
      }
    }

    return {
      ...def,
      status,
      pill,
      actors: actorsByStage[def.index],
      failureDetail: status === 'failed' || status === 'voided' ? failureReason : undefined,
    };
  });

  return {
    effectiveStatus,
    stages,
    completedHops,
    faultStageIndex,
    failureReason,
  };
}

function stageIcon(stageKey: MacroStageKey, status: StageVisualStatus) {
  if (status === 'failed') return <AlertTriangle className="w-4 h-4" />;
  if (status === 'voided') return <Ban className="w-4 h-4" />;
  if (status === 'completed') return <Check className="w-4 h-4 stroke-[2.5]" />;

  switch (stageKey) {
    case 'capture':
      return <FileSearch className="w-4 h-4" />;
    case 'validation':
      return <GitCompare className="w-4 h-4" />;
    case 'approval':
      return <ShieldCheck className="w-4 h-4" />;
    case 'settlement':
      return <Landmark className="w-4 h-4" />;
  }
}

export const InvoiceStateStepper: React.FC<InvoiceStateStepperProps> = ({
  invoice,
  auditLogs = [],
  actorFor,
  expectedApprover = null,
  isTransitioning = false,
  onStageClick,
  compact = false,
}) => {
  const model = useMemo(
    () => deriveStepperModel(invoice, auditLogs, actorFor),
    [invoice, auditLogs, actorFor],
  );

  // Initialize synchronously to completedHops so SSR / initial paint matches full current state
  const [animatedStep, setAnimatedStep] = useState<number>(model.completedHops);
  const [replayNonce, setReplayNonce] = useState<number>(0);
  const lastInvoiceIdRef = useRef<string>(invoice.id);
  const prevTargetHopsRef = useRef<number>(model.completedHops);

  useEffect(() => {
    const isNewInvoice = lastInvoiceIdRef.current !== invoice.id;
    const isForwardHop = model.completedHops > prevTargetHopsRef.current;

    lastInvoiceIdRef.current = invoice.id;
    prevTargetHopsRef.current = model.completedHops;

    if (model.completedHops === 0) {
      setAnimatedStep(0);
      return;
    }

    let current = isNewInvoice || replayNonce > 0 ? 0 : isForwardHop ? Math.max(0, model.completedHops - 1) : model.completedHops;

    if (current >= model.completedHops) {
      setAnimatedStep(model.completedHops);
      return;
    }

    setAnimatedStep(current);
    const timer = setInterval(() => {
      current += 1;
      setAnimatedStep(current);
      if (current >= model.completedHops) {
        clearInterval(timer);
      }
    }, 700);

    return () => clearInterval(timer);
  }, [invoice.id, model.completedHops, replayNonce]);

  const statusBadgeClass =
    model.effectiveStatus === 'PAID'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : model.effectiveStatus === 'FAILED' || model.effectiveStatus === 'VOID'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : 'bg-[#e8f7ed] text-[#14532d] border-[#d7ebdd]';

  return (
    <section
      data-testid="invoice-state-stepper"
      aria-label="Invoice State Progress"
      className={`bg-white border border-[#e6ebe8] rounded-xl shadow-xs ${
        compact ? 'p-3.5' : 'p-4 sm:p-5'
      }`}
    >
      {/* Top Status & Replay Controls */}
      <div className={`flex flex-wrap items-center justify-between gap-2 ${compact ? 'mb-3' : 'mb-4'}`}>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#14532d]">
            Invoice State Progress
          </h2>
          <span
            className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border ${statusBadgeClass}`}
          >
            {model.effectiveStatus}
          </span>
          {model.effectiveStatus === 'PAID' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border border-dashed border-emerald-300 bg-emerald-50/70 text-emerald-700">
              <Sparkles className="w-3 h-3" />
              Straight-Through Complete
            </span>
          )}
          {model.failureReason && (
            <span className="text-[11px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-medium">
              {model.failureReason}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setReplayNonce((n) => n + 1)}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#68766f] hover:text-[#14532d] bg-[#f8faf9] hover:bg-[#e8f7ed] border border-[#e6ebe8] hover:border-[#d7ebdd] px-2.5 py-1 rounded-md transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Replay State Journey</span>
        </button>
      </div>

      {/* 4 Macro-Anchored Stages + Left-to-Right Horizontal Progress Bars */}
      <div className="flex flex-col md:flex-row items-stretch md:items-start gap-3 md:gap-0">
        {model.stages.map((stage, idx) => {
          const isCompleted = stage.status === 'completed';
          const isActive = stage.status === 'active';
          const isFailed = stage.status === 'failed' || stage.status === 'voided';

          const circleClass = isCompleted
            ? 'bg-[#16834a] text-white border-[#16834a] shadow-xs'
            : isActive
              ? 'bg-[#16834a] text-white border-[#16834a] ring-4 ring-[#d7ebdd]'
              : isFailed
                ? 'bg-rose-600 text-white border-rose-600 ring-4 ring-rose-100'
                : 'bg-[#f8faf9] text-[#98a29c] border-[#e6ebe8]';

          const cardClass = isFailed
            ? 'border-rose-200 bg-rose-50/50 hover:border-rose-300'
            : isActive
              ? 'border-[#16834a]/40 bg-[#e8f7ed]/50 hover:border-[#16834a]'
              : isCompleted
                ? 'border-[#d7ebdd] bg-[#f6fbf8] hover:border-[#16834a]/50'
                : 'border-[#e6ebe8] bg-[#f8faf9]/60 hover:border-[#d7ebdd]';

          const pillClass =
            stage.pill?.kind === 'auto'
              ? 'border-dashed border-emerald-300 bg-emerald-50/80 text-emerald-700'
              : stage.pill?.kind === 'manual'
                ? 'border-[#e6ebe8] bg-[#f8faf9] text-[#25362f]'
                : stage.pill?.kind === 'fault'
                  ? 'border-rose-300 bg-rose-100 text-rose-800'
                  : 'border-[#d7ebdd] bg-[#e8f7ed] text-[#14532d]';

          // Inter-stage bar between stage[idx] and stage[idx + 1]
          const hasNextConnector = idx < model.stages.length - 1;
          const segmentFilled = idx < animatedStep;
          const isCurrentInFlightSegment =
            isTransitioning &&
            ((idx === model.completedHops && !model.faultStageIndex) ||
              (model.effectiveStatus === 'PROCESSING_PAYMENT' && idx === 2));

          const barFillPercent = segmentFilled ? 100 : isCurrentInFlightSegment ? 60 : 0;
          const barFillClass = isFailed
            ? 'bg-rose-500'
            : isCurrentInFlightSegment
              ? 'bg-gradient-to-r from-[#16834a] via-emerald-400 to-[#14532d] animate-pulse'
              : segmentFilled && model.faultStageIndex === idx + 1
                ? 'bg-amber-500'
                : 'bg-[#16834a]';

          return (
            <React.Fragment key={stage.key}>
              <div
                data-testid={`stepper-stage-${stage.key}`}
                data-stage-status={stage.status}
                className="flex-1 min-w-0"
              >
                <button
                  type="button"
                  onClick={() => onStageClick?.(stage.key, stage)}
                  className={`w-full text-left rounded-lg border transition-all ${
                    compact ? 'p-2.5' : 'p-3'
                  } ${cardClass} ${onStageClick ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-colors ${circleClass}`}
                    >
                      {stageIcon(stage.key, stage.status)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[#25362f] truncate">{stage.title}</div>
                      <div className="text-[11px] text-[#68766f] truncate">{stage.subtitle}</div>
                    </div>
                  </div>

                  {/* Compliance Pill + Actor Avatar Facepile */}
                  <div className="mt-2.5 flex items-center justify-between gap-2 min-h-[24px]">
                    {stage.pill ? (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pillClass}`}
                      >
                        {stage.pill.kind === 'auto' && <Sparkles className="w-2.5 h-2.5" />}
                        {stage.pill.kind === 'manual' && <UserCheck className="w-2.5 h-2.5" />}
                        <span>{stage.pill.label}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#98a29c] font-medium">Pending</span>
                    )}

                    {stage.actors.length > 0 && (
                      <div className="flex items-center -space-x-1.5 shrink-0">
                        {stage.actors.slice(0, 3).map((actor) => (
                          <div key={`${stage.key}-${actor.id}-${actor.name}`} className="relative group/avatar">
                            <UserAvatar
                              userId={actor.id}
                              name={actor.name}
                              role={actor.role}
                              avatarUrl={actor.avatarUrl}
                              isSystem={actor.isSystem}
                              sizeClassName="size-6"
                              className="ring-2 ring-white shadow-xs"
                              title={`${actor.name} · ${actor.role} · ${actor.actionLabel}${
                                actor.timestamp ? ` · ${actor.timestamp}` : ''
                              }`}
                            />

                            {/* Hover Tooltip */}
                            <div className="pointer-events-none opacity-0 group-hover/avatar:opacity-100 transition-opacity absolute right-0 bottom-full mb-1.5 z-30 w-max max-w-[220px] px-2.5 py-1.5 rounded-md bg-[#14532d] text-white text-[10px] shadow-lg">
                              <div className="font-semibold">
                                {actor.name} · {actor.role}
                              </div>
                              <div className="text-[#d7ebdd] truncate">{actor.actionLabel}</div>
                              {actor.timestamp && (
                                <div className="text-[#98a29c] font-mono text-[9px]">{actor.timestamp}</div>
                              )}
                            </div>
                          </div>
                        ))}
                        {stage.actors.length > 3 && (
                          <span className="w-6 h-6 rounded-full ring-2 ring-white bg-[#e8f7ed] text-[#14532d] flex items-center justify-center text-[9px] font-bold">
                            +{stage.actors.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {stage.key === 'approval' && isActive && expectedApprover && (
                    <div className="mt-2 pt-2 border-t border-[#d7ebdd] flex items-center gap-2 min-w-0">
                      <UserAvatar
                        userId={expectedApprover.id}
                        name={expectedApprover.name}
                        role={expectedApprover.role}
                        avatarUrl={expectedApprover.avatarUrl}
                        sizeClassName="size-5"
                        highlightRing
                      />
                      <span className="text-[10px] font-semibold text-[#14532d] truncate">
                        Next: {expectedApprover.name}
                      </span>
                    </div>
                  )}
                </button>
              </div>

              {hasNextConnector && (
                <div
                  data-testid={`stepper-connector-${idx}`}
                  className="hidden md:flex items-center w-8 lg:w-12 shrink-0 pt-7 px-1"
                  aria-hidden="true"
                >
                  <div className="w-full h-2 rounded-full bg-[#e6ebe8] overflow-hidden">
                    <div
                      data-testid={`stepper-progress-fill-${idx}`}
                      className={`h-full rounded-full transition-[width] duration-700 ease-out ${barFillClass}`}
                      style={{ width: `${barFillPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
};

