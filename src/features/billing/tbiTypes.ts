// ============================================================================
// TBI BANK SERVICE TYPES
// TypeScript interfaces for TBI Bank Fusion Pay integration
// ============================================================================

// ============================================================================
// TBI API REQUEST/RESPONSE TYPES
// ============================================================================

export interface TBIInstallmentScheme {
  scheme_id: number;
  name: string;
  period: number;
  installment_factor: number;
  total_due_factor: number;
  monthly_amount_cents: number;
  total_amount_cents: number;
  nir: number;
  apr: number;
  amount_min: number;
  amount_max: number;
  currency: string;
}

export interface TBIGetCalculationsResponse {
  success: boolean;
  schemes?: TBIInstallmentScheme[];
  cached?: boolean;
  error?: string;
}

export interface TBICustomerData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  egn: string; // Bulgarian personal ID
}

// ============================================================================
// APPLICATION STATUS ENUMS
// ============================================================================

export type TBIApplicationStatus =
  | 'pending'      // Application submitted, waiting for TBI
  | 'processing'   // TBI is reviewing
  | 'approved'     // Approved, waiting for customer confirmation
  | 'rejected'     // Rejected by TBI
  | 'cancelled'    // Cancelled by customer
  | 'completed'    // Loan finalized, access granted
  | 'expired';     // Application expired

export const TBI_STATUS_LABELS: Record<TBIApplicationStatus, string> = {
  pending: 'Pending Review',
  processing: 'Under Review',
  approved: 'Approved',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed',
  expired: 'Expired',
};

export const TBI_STATUS_COLORS: Record<TBIApplicationStatus, string> = {
  pending: 'text-[#EAB308] bg-[#EAB308]/10',
  processing: 'text-[#A0A0A0] bg-[#1F1F1F]',
  approved: 'text-[#22C55E] bg-[#22C55E]/10',
  rejected: 'text-[#EF4444] bg-[#EF4444]/10',
  cancelled: 'text-[#666666] bg-[#1F1F1F]',
  completed: 'text-[#22C55E] bg-[#22C55E]/10',
  expired: 'text-[#666666] bg-[#1F1F1F]',
};

// ============================================================================
// DATABASE TYPES (matching tbi_applications table)
// ============================================================================

export interface TBIApplication {
  id: string;
  community_id: string | null;
  course_id: string | null;
  buyer_id: string;
  creator_id: string;
  membership_id: string | null;
  
  // TBI Data
  tbi_application_id: string | null;
  tbi_order_id: string | null;
  
  // Financial
  amount_cents: number;
  currency: string;
  scheme_id: number | null;
  downpayment_cents: number;
  monthly_installment_cents: number | null;
  installment_count: number | null;
  
  // Status
  status: TBIApplicationStatus;
  tbi_status: string | null;
  
  // Customer Data
  customer_email: string | null;
  customer_phone: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_egn: string | null;
  
  // Tracking
  status_url: string | null;
  callback_received_at: string | null;
  callback_payload: Record<string, unknown> | null;
  
  // Access Control
  access_granted: boolean;
  access_granted_at: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  
  // Joins
  community?: { id: string; name: string };
  course?: { id: string; title: string };
}

// ============================================================================
// SERVICE REQUEST/RESPONSE TYPES
// ============================================================================

export interface TBICalculatorRequest {
  amountCents: number;
}

export interface TBICalculatorResult {
  success: boolean;
  schemes?: TBIInstallmentScheme[];
  error?: string;
}

export interface TBICheckoutRequest {
  productType: 'community' | 'course';
  productId: string;
  productName: string;
  amountCents: number;
  schemeId: number;
  customer: TBICustomerData;
  successUrl: string;
  cancelUrl: string;
}

export interface TBICheckoutResult {
  success: boolean;
  applicationId?: string;
  redirectUrl?: string;
  iframeUrl?: string;
  error?: string;
}

export interface TBIStatusResult {
  success: boolean;
  application?: TBIApplication;
  error?: string;
}

// ============================================================================
// UI COMPONENT PROPS
// ============================================================================

export interface TBICalculatorProps {
  amountCents: number;
  currency?: string;
  onSchemeSelect?: (scheme: TBIInstallmentScheme) => void;
  selectedSchemeId?: number;
  className?: string;
}

export interface TBIButtonProps {
  amountCents: number;
  currency?: string;
  productName: string;
  productType: 'community' | 'course';
  productId: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  style?: 'light' | 'dark' | 'outline' | 'minimal';
}

export interface TBIApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  productType: 'community' | 'course';
  productId: string;
  productName: string;
  amountCents: number;
  scheme: TBIInstallmentScheme;
  onSuccess?: () => void;
}

export interface TBIStatusTrackerProps {
  applicationId: string;
  onStatusChange?: (status: TBIApplicationStatus) => void;
  onComplete?: () => void;
  pollInterval?: number; // milliseconds
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface TBIConfig {
  resellerCode: string;
  baseUrl: string;
  minAmountCents: number; // 5000 = 50 EUR
  maxAmountCents: number; // 249999 = 2499.99 EUR
  currency: string;
  cacheDurationMinutes: number;
}

export const TBI_CONFIG: TBIConfig = {
  resellerCode: import.meta.env.VITE_TBI_RESELLER_CODE || 'BJKZ',
  baseUrl: import.meta.env.VITE_TBI_API_URL || 'https://beta.tbibank.support/api',
  minAmountCents: 5000, // 50 EUR minimum
  maxAmountCents: 249999, // 2499.99 EUR maximum
  currency: 'EUR',
  cacheDurationMinutes: 1440, // 24 hours
};

// ============================================================================
// WEBHOOK PAYLOAD TYPES
// ============================================================================

/** TBI's actual webhook payload format */
export interface TBIWebhookPayload {
  CreditApplicationId: string;
  StatusUrl?: string;
  OrderId: string;
  Status: number | string;
  Message: string;
  ResellerCode: string;
  System?: string;
  ContractNumber?: string | null;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export type TBIErrorCode =
  | 'INVALID_AMOUNT'
  | 'BELOW_MINIMUM'
  | 'ABOVE_MAXIMUM'
  | 'INVALID_SCHEME'
  | 'CUSTOMER_DATA_MISSING'
  | 'ENCRYPTION_ERROR'
  | 'API_ERROR'
  | 'APPLICATION_NOT_FOUND'
  | 'EXPIRED_APPLICATION';

export class TBIError extends Error {
  constructor(
    message: string,
    public code: TBIErrorCode,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TBIError';
  }
}
