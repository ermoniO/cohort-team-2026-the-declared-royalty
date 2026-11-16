import { PayerPolicy, RoleProfile, UserRole } from '../types';

export const ROLE_PROFILES: Record<UserRole, RoleProfile> = {
  ap_specialist: {
    id: 'ap_specialist',
    title: 'AP / Finance Specialist',
    approvalLimit: 1000,
    canEditPolicy: false,
    canExecutePayments: true,
    canOverrideDuplicates: true,
    description:
      'Ingests invoices, verifies AI extractions, resolves mismatches, and processes approvals under $1,000.',
  },
  property_manager: {
    id: 'property_manager',
    title: 'Property / Operations Manager',
    approvalLimit: 10000,
    canEditPolicy: true,
    canExecutePayments: true,
    canOverrideDuplicates: true,
    description:
      'Authorizes operational invoices between $1,000 and $10,000 and configures property-specific policy thresholds.',
  },
  vp_finance: {
    id: 'vp_finance',
    title: 'VP Finance / Executive Approver',
    approvalLimit: Infinity,
    canEditPolicy: true,
    canExecutePayments: true,
    canOverrideDuplicates: true,
    description:
      'Executive signing authority for capital outlays >$10,000 and portfolio-wide disbursement releases.',
  },
  admin_auditor: {
    id: 'admin_auditor',
    title: 'System Administrator / Auditor',
    approvalLimit: 0,
    canEditPolicy: true,
    canExecutePayments: false,
    canOverrideDuplicates: true,
    description:
      'Oversees regulatory compliance, rule governance, system logs, and complete audit trail immutability.',
  },
  ADMIN: {
    id: 'ADMIN',
    title: 'System Administrator',
    approvalLimit: Infinity,
    canEditPolicy: true,
    canExecutePayments: true,
    canOverrideDuplicates: true,
    description:
      'Full portfolio administrative access, policy governance, and configuration oversight.',
  },
  ACCOUNTANT: {
    id: 'ACCOUNTANT',
    title: 'Corporate Accountant',
    approvalLimit: 1000,
    canEditPolicy: false,
    canExecutePayments: true,
    canOverrideDuplicates: true,
    description:
      'Verifies accounting codes, manages invoices, and processes day-to-day accounts payable.',
  },
  PROPERTY_MANAGER: {
    id: 'PROPERTY_MANAGER',
    title: 'Property Manager',
    approvalLimit: 2500,
    canEditPolicy: true,
    canExecutePayments: true,
    canOverrideDuplicates: true,
    description:
      'Oversees day-to-day operational expenses and minor maintenance up to authorized property limits.',
  },
  SENIOR_PROPERTY_MANAGER: {
    id: 'SENIOR_PROPERTY_MANAGER',
    title: 'Senior Property Manager',
    approvalLimit: 10000,
    canEditPolicy: true,
    canExecutePayments: true,
    canOverrideDuplicates: true,
    description:
      'Manages major operating budgets, contracts, and mid-tier operational disbursements.',
  },
  REGIONAL_DIRECTOR: {
    id: 'REGIONAL_DIRECTOR',
    title: 'Regional Director',
    approvalLimit: 50000,
    canEditPolicy: true,
    canExecutePayments: true,
    canOverrideDuplicates: true,
    description:
      'Supervises regional portfolio assets, approving high-value recurring or capital invoices.',
  },
  VICE_PRESIDENT: {
    id: 'VICE_PRESIDENT',
    title: 'Vice President',
    approvalLimit: Infinity,
    canEditPolicy: true,
    canExecutePayments: true,
    canOverrideDuplicates: true,
    description:
      'Executive authority for company-wide treasury and unlimited capital approvals.',
  },
};

export const DEFAULT_PAYER_POLICY: PayerPolicy = {
  maxAutoApproveAmount: 0,
  maxAutoPayAmount: 0,
  minConfidenceScore: 85,
  requiresPoMatch: false,
  autoPayEnabled: false,
};
