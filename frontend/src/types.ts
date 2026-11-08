export type UserRole = 'ap_specialist' | 'property_manager' | 'vp_finance' | 'admin_auditor';

export interface RoleProfile {
    id: UserRole;
    title: string;
    approvalLimit: number; // e.g. 1000 for AP, 10000 for PM, Infinity for VP, -1 for Auditor
    canEditPolicy: boolean;
    canExecutePayments: boolean;
    canOverrideDuplicates: boolean;
    description: string;
}

export interface AppUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    title: string;
    status: 'ACTIVE' | 'INACTIVE';
    assignedPropertyIds: string[]; // empty array = portfolio-wide access
    avatarUrl?: string;
}

export type InvoiceStatus =
    | 'intake'
    | 'extracted'
    | 'matched'
    | 'pending_approval'
    | 'approved'
    | 'paid'
    | 'exception';

export type ApprovalTier =
    | 'auto_approved'
    | 'property_manager'
    | 'vp_finance';

export type ExceptionType =
    | 'unknown_vendor'
    | 'policy_limit_exceeded'
    | 'inconsistent_totals'
    | 'missing_line_items'
    | 'payment_failed'
    | 'conflicting_data';

export type IntakeMethod =
    | 'pdf_upload'
    | 'manual_entry'
    | 'email_parsing'
    | 'edi_feed';

export type PaymentMethod = string;

export type PaymentStatus =
    | 'unpaid'
    | 'scheduled'
    | 'processing'
    | 'succeeded'
    | 'declined'
    | 'failed';

export interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unitRate: number;
    amount: number;
    glCode?: string;
}

export interface AuditEvent {
    id: string;
    timestamp: string;
    eventType: string;
    description: string;
    user: string;
    role: string;
    metadata?: Record<string, string | number | boolean | undefined>;
}

export interface DuplicateMatch {
    isDuplicate: boolean;
    matchedInvoiceId?: string;
    matchedInvoiceNumber?: string;
    matchedVendorName?: string;
    matchedDate?: string;
    matchedAmount?: number;
    similarityScore: number;
    dismissed?: boolean;
    dismissalReason?: string;
    dismissedBy?: string;
}

export interface PayerPolicy {
    maxAutoApproveAmount: number;
    maxAutoPayAmount: number;
    minConfidenceScore: number;
    requiresPoMatch: boolean;
    autoPayEnabled: boolean;
}

export interface Property {
    id: string;
    name: string;
    address: string;
    propertyType: string;
    managerName: string;
    sqft: number;
    policy: PayerPolicy;
    hasCustomPolicy: boolean;
}

export interface Vendor {
    id: string;
    name: string;
    category: string;
    accountNumber: string;
    defaultPaymentMethod: PaymentMethod;
    remittanceAddress: string;
    taxId: string;
    status: 'verified' | 'unverified' | 'pending_review';
    historicalMatchesCount: number;
    phoneNumber?: string;
    paymentUrl?: string;
}

export interface PropertyVendorRelationship {
    id: string;
    propertyId: string;
    propertyName: string;
    vendorId: string;
    vendorName: string;
    vendorAccountNumber: string;
    autoApprovalEnabled: boolean;
    status: 'ACTIVE' | 'INACTIVE';
    createdAt?: string;
}

export interface InvoiceException {
    type: ExceptionType;
    message: string;
    aiSuggestion?: string;
    assignedTo?: string;
    resolved?: boolean;
    overrideReason?: string;
}

export interface InvoicePaymentInfo {
    method: PaymentMethod;
    status: PaymentStatus;
    transactionRef?: string;
    paidAt?: string;
    cardLast4?: string;
    authCode?: string;
    failureReason?: string;
}

export interface Invoice {
    id: string;
    invoiceNumber: string;
    accountNumber: string;
    vendorId: string;
    vendorName: string;
    propertyId: string;
    propertyName: string;
    issueDate: string;
    dueDate: string;
    subtotal: number;
    tax: number;
    amount: number;
    lineItems: LineItem[];
    status: InvoiceStatus;
    confidenceScore: number;
    approvalTier: ApprovalTier;
    intakeMethod: IntakeMethod;
    duplicateMatch?: DuplicateMatch;
    exception?: InvoiceException;
    paymentInfo?: InvoicePaymentInfo;
    auditTrail: AuditEvent[];
    notes?: string;
    documentType?: 'utility' | 'maintenance' | 'capital_expenditure' | 'janitorial' | 'emergency';
}

export interface ActivityItem {
    id: string;
    timestamp: string;
    title: string;
    subtitle: string;
    type: 'intake' | 'extraction' | 'match' | 'policy' | 'approval' | 'payment' | 'exception';
    status: 'success' | 'warning' | 'info' | 'error';
    invoiceId?: string;
}

export type NavTab =
    | 'dashboard'
    | 'intake'
    | 'matching'
    | 'policy'
    | 'approvals'
    | 'payments'
    | 'exceptions'
    | 'audit';
