// ============================================================================
// TBI BANK SHARED UTILITIES
// Server-side TBI Bank Fusion Pay configuration and helpers
// ============================================================================
//
// This module provides:
// - TBI API configuration
// - AES-256-CTR encryption for RegisterApplication (matches TBI's Cryptor.php)
// - API client methods (GetCalculations, RegisterApplication, etc.)
// - Webhook payload parsing
// - Status mapping from real TBI statuses
//
// SECURITY NOTE:
// All TBI API credentials (TBI_RESELLER_KEY, TBI_ENCRYPTION_KEY) are stored
// in Supabase secrets and never exposed to the client.
// ============================================================================

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface TBIConfig {
  resellerCode: string;
  resellerKey: string;
  baseUrl: string;
  encryptionKey: string;
  webhookSecret: string;
  minAmountCents: number;
  maxAmountCents: number;
  currency: string;
  applicationExpiryDays: number;
}

/**
 * Get TBI configuration from environment
 */
export function getTBIConfig(): TBIConfig {
  const resellerKey = Deno.env.get('TBI_RESELLER_KEY');
  const encryptionKey = Deno.env.get('TBI_ENCRYPTION_KEY');
  const webhookSecret = Deno.env.get('TBI_WEBHOOK_SECRET');

  if (!resellerKey) {
    throw new Error('TBI_RESELLER_KEY is not configured');
  }

  return {
    resellerCode: Deno.env.get('TBI_RESELLER_CODE') || 'BJKZ',
    resellerKey,
    baseUrl: Deno.env.get('TBI_API_URL') || 'https://beta.tbibank.support/api',
    encryptionKey: encryptionKey || '',
    webhookSecret: webhookSecret || '',
    minAmountCents: 5000, // 50 EUR
    maxAmountCents: 249999, // 2499.99 EUR
    currency: 'EUR',
    applicationExpiryDays: 7,
  };
}

// ============================================================================
// API TYPES - Real TBI API formats
// ============================================================================

// --- GetCalculations ---

/** What TBI actually returns: a raw array of scheme objects */
export interface TBIRawScheme {
  id: number;
  name: string;
  bank_product: string;
  period: number;
  installment_factor: number;
  total_due_factor: number;
  nir: number;
  apr: number;
  amount_min: number;
  amount_max: number;
  category_id: number;
  currency?: string;
  // EUR transition fields
  amount_min_bgn?: number;
  amount_max_bgn?: number;
  amount_min_eur?: number;
  amount_max_eur?: number;
}

/** Our normalized scheme format used by edge functions and frontend */
export interface TBICalculationScheme {
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
  schemes?: TBICalculationScheme[];
  error?: string;
}

// --- RegisterApplication ---

/** Delivery address for TBI RegisterApplication */
export interface TBIDeliveryAddress {
  country: string;
  county: string;
  city: string;
  streetname: string;
  streetno: string;
  buildingno: string;
  entranceno: string;
  floorno: string;
  apartmentno: string;
  postalcode: string;
}

/** The encrypted JSON payload structure for RegisterApplication */
export interface TBIRegisterPayload {
  orderid: string;
  firstname?: string;
  lastname?: string;
  surname?: string;
  email?: string;
  phone?: string;
  deliveryaddress?: TBIDeliveryAddress;
  items: TBIItem[];
  period?: number;
  scheme_id?: number; // TBI scheme ID from GetCalculations
  downpayment?: number; // Down payment amount (0 for no down payment)
  promo?: boolean;
  bnpl?: number; // 1 or 0
  successRedirectURL?: string;
  failRedirectURL?: string;
  statusURL?: string;
  currency?: string; // "EUR" - mandatory from Jan 2026
}

export interface TBIItem {
  name: string;
  description?: string;
  qty: string; // TBI expects string
  price: string; // TBI expects string, EUR decimal (e.g. "24.87")
  sku?: string; // Product SKU/code
  category: string; // REQUIRED by TBI - product category ID
  imagelink?: string; // Product image URL
}

/** TBI's actual RegisterApplication response */
export interface TBIRegisterResponse {
  error: number; // 0 = success
  order_id?: number;
  token?: string;
  url?: string; // The redirect URL
  message?: string; // Error message if error != 0
}

/** Our normalized register response */
export interface TBIRegisterApplicationResponse {
  success: boolean;
  application_id?: string; // order_id from TBI
  token?: string;
  redirect_url?: string;
  error?: string;
}

// --- Status Check ---

export interface TBIStatusCheckResponse {
  success: boolean;
  status?: string;
  tbi_status?: string;
  error?: string;
}

// --- Cancel ---

export interface TBICancelResponse {
  success: boolean;
  error?: string;
}

// --- Webhook ---

/** TBI's actual webhook payload format */
export interface TBIWebhookPayload {
  CreditApplicationId: string;
  StatusUrl?: string;
  OrderId: string;
  Status: number | string; // Can be number or string
  Message: string; // The actual status text
  ResellerCode: string;
  System?: string; // e.g. "FTOS" for BNPL
  ContractNumber?: string | null;
}

/** Our normalized webhook payload */
export interface TBINormalizedWebhookPayload {
  application_id: string;
  order_id: string;
  status: string;
  status_code: number | string;
  reseller_code: string;
  system?: string;
  contract_number?: string | null;
}

// --- Customer/Product types for checkout ---

export interface TBICustomerData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  egn: string;
}

// ============================================================================
// AES-256-CTR ENCRYPTION
// ============================================================================

/**
 * Encrypt data using AES-256-CTR for TBI RegisterApplication
 *
 * Matches TBI's PHP Cryptor class:
 * - Algorithm: aes-256-ctr
 * - Key: SHA-256 hash of the encryption key (raw binary, 32 bytes)
 * - IV: Random 16 bytes, prepended to ciphertext
 * - Output: base64(IV + ciphertext)
 * - Flag: OPENSSL_RAW_DATA (raw binary, no built-in base64)
 */
export async function encryptForTBI(plaintext: string, encryptionKey: string): Promise<string> {
  const encoder = new TextEncoder();

  // Hash the key with SHA-256 (matches PHP: openssl_digest($key, 'sha256', true))
  const keyHash = await crypto.subtle.digest('SHA-256', encoder.encode(encryptionKey));
  const keyBytes = new Uint8Array(keyHash); // 32 bytes

  // Generate random IV (matches PHP: openssl_random_pseudo_bytes(16))
  const iv = crypto.getRandomValues(new Uint8Array(16));

  // Import key for AES-CTR
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-CTR' },
    false,
    ['encrypt']
  );

  // Encrypt (AES-CTR, no padding needed — stream cipher)
  const plaintextBytes = encoder.encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter: iv, length: 128 },
    cryptoKey,
    plaintextBytes
  );

  // Prepend IV to ciphertext (matches PHP: $iv . $encrypted)
  const cipherBytes = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.length);

  // Base64 encode (matches PHP: base64_encode($res))
  let binaryStr = '';
  for (let i = 0; i < combined.length; i++) {
    binaryStr += String.fromCharCode(combined[i]);
  }
  return btoa(binaryStr);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Hash EGN using SHA-256 (never store plain text EGN)
 */
export async function hashEGN(egn: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(egn);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a unique order ID for TBI
 * Format: CC-{timestamp}-{random}
 */
export function generateOrderId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().split('-')[0];
  return `CC-${timestamp}-${random}`.toUpperCase();
}

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Make a raw request to TBI API
 */
async function tbiRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
  config: TBIConfig
): Promise<T> {
  const url = `${config.baseUrl}/${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Read raw text first to handle non-JSON responses
    const rawText = await response.text();

    if (!response.ok) {
      console.error(`TBI API error (${response.status}):`, rawText.substring(0, 1000));
      throw new Error(`TBI API error: ${response.status} ${response.statusText}`);
    }

    // Try to parse as JSON
    try {
      return JSON.parse(rawText) as T;
    } catch {
      // TBI returned non-JSON (likely PHP error page)
      console.error(`TBI ${endpoint} returned non-JSON:`, rawText.substring(0, 2000));
      throw new Error(`TBI returned invalid response from ${endpoint}: ${rawText.substring(0, 500)}`);
    }
  } catch (error) {
    console.error('TBI API request failed:', error);
    throw error;
  }
}

/**
 * Get available installment schemes from TBI
 * TBI returns a raw array of scheme objects, not wrapped in {success, schemes}
 */
export async function getCalculations(
  amountCents: number
): Promise<TBIGetCalculationsResponse> {
  const config = getTBIConfig();

  // TBI expects amount as EUR decimal, not cents
  const amountEur = amountCents / 100;

  try {
    // TBI returns a raw array directly
    const rawSchemes = await tbiRequest<TBIRawScheme[]>(
      'GetCalculations',
      {
        reseller_code: config.resellerCode,
        reseller_key: config.resellerKey,
        amount: String(amountEur),
      },
      config
    );

    // Check for error response (TBI returns {error, message} on failure)
    if (!Array.isArray(rawSchemes)) {
      const errorObj = rawSchemes as unknown as { error: number; message: string };
      return {
        success: false,
        error: errorObj.message || `TBI error code: ${errorObj.error}`,
      };
    }

    // Transform raw TBI schemes to our normalized format
    const schemes: TBICalculationScheme[] = rawSchemes.map((raw) => ({
      scheme_id: raw.id,
      name: raw.name,
      period: raw.period,
      installment_factor: raw.installment_factor,
      total_due_factor: raw.total_due_factor,
      // Calculate monthly and total amounts in EUR cents
      monthly_amount_cents: Math.round(amountEur * raw.installment_factor * 100),
      total_amount_cents: Math.round(amountEur * raw.total_due_factor * 100),
      nir: raw.nir,
      apr: raw.apr,
      amount_min: raw.amount_min,
      amount_max: raw.amount_max,
      currency: raw.currency || 'EUR',
    }));

    return {
      success: true,
      schemes,
    };
  } catch (error) {
    console.error('GetCalculations error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get calculations',
    };
  }
}

/**
 * Register a new application with TBI
 * Uses AES-256-CTR encryption for the data payload
 */
export async function registerApplication(
  orderId: string,
  amountCents: number,
  schemeId: number,
  customer: TBICustomerData,
  productName: string,
  successUrl: string,
  failureUrl: string,
  statusUrl: string
): Promise<TBIRegisterApplicationResponse> {
  const config = getTBIConfig();

  if (!config.encryptionKey) {
    return {
      success: false,
      error: 'TBI_ENCRYPTION_KEY is not configured',
    };
  }

  // TBI expects amount as EUR decimal
  const amountEur = (amountCents / 100).toFixed(2);

  // Build the JSON payload that gets encrypted
  // Must include currency: 'EUR' (mandatory from Jan 2026)
  // TBI's Request.class.php crashes with null if currency is missing
  const payload: TBIRegisterPayload = {
    orderid: orderId,
    firstname: customer.first_name,
    lastname: customer.last_name,
    surname: '', // TBI requires this field even if empty
    email: customer.email,
    phone: customer.phone.replace(/[\s\-\(\)\.]/g, ''),
    deliveryaddress: {
      country: 'Bulgaria',
      county: '',
      city: '',
      streetname: '',
      streetno: '',
      buildingno: '',
      entranceno: '',
      floorno: '',
      apartmentno: '',
      postalcode: '',
    },
    items: [
      {
        name: productName,
        description: '',
        qty: '1',
        price: amountEur,
        sku: '',
        category: '255', // Generic product category (required by TBI)
      },
    ],
    successRedirectURL: successUrl,
    failRedirectURL: failureUrl,
    statusURL: statusUrl,
    scheme_id: schemeId, // TBI scheme ID from GetCalculations
    downpayment: 0,
    currency: 'EUR',
  };

  try {
    // Encrypt the payload
    const jsonPayload = JSON.stringify(payload);
    const encryptedData = await encryptForTBI(jsonPayload, config.encryptionKey);

    // Send to TBI: {reseller_code, reseller_key, data: encrypted_string}
    const tbiResponse = await tbiRequest<TBIRegisterResponse>(
      'RegisterApplication',
      {
        reseller_code: config.resellerCode,
        reseller_key: config.resellerKey,
        data: encryptedData,
      },
      config
    );

    // TBI returns error: 0 on success
    if (tbiResponse.error !== 0) {
      return {
        success: false,
        error: tbiResponse.message || `TBI error code: ${tbiResponse.error}`,
      };
    }

    return {
      success: true,
      application_id: String(tbiResponse.order_id),
      token: tbiResponse.token,
      redirect_url: tbiResponse.url,
    };
  } catch (error) {
    console.error('RegisterApplication error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register application',
    };
  }
}

/**
 * Check application status via TBI API
 * Uses getApplicationStatus endpoint
 */
export async function checkApplicationStatus(
  applicationId?: string,
  orderId?: string
): Promise<TBIStatusCheckResponse> {
  const config = getTBIConfig();

  if (!applicationId && !orderId) {
    return {
      success: false,
      error: 'Either applicationId or orderId is required',
    };
  }

  try {
    const requestBody: Record<string, unknown> = {
      reseller_code: config.resellerCode,
      reseller_key: config.resellerKey,
    };

    if (applicationId) {
      requestBody.application_id = applicationId;
    }
    if (orderId) {
      requestBody.order_id = orderId;
    }

    const response = await tbiRequest<Record<string, unknown>>(
      'getApplicationStatus',
      requestBody,
      config
    );

    // TBI returns {error: 0, status: "...", ...} on success
    if (response.error && response.error !== 0) {
      return {
        success: false,
        error: (response.message as string) || `TBI error: ${response.error}`,
      };
    }

    return {
      success: true,
      status: mapTBIStatus(response.status as string || response.Message as string || ''),
      tbi_status: (response.status as string) || (response.Message as string) || '',
    };
  } catch (error) {
    console.error('getApplicationStatus error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check status',
    };
  }
}

/**
 * Cancel an application (not directly supported by TBI API in docs,
 * but we update our local status)
 */
export async function cancelApplication(
  _applicationId?: string,
  _orderId?: string
): Promise<TBICancelResponse> {
  // TBI doesn't have a direct cancel endpoint in the API docs.
  // Cancellation is handled locally by updating our database status.
  return { success: true };
}

// ============================================================================
// WEBHOOK PARSING
// ============================================================================

/**
 * Parse TBI webhook payload from their format to our normalized format
 * TBI sends: {CreditApplicationId, StatusUrl, OrderId, Status, Message, ResellerCode, ...}
 */
export function parseWebhookPayload(raw: TBIWebhookPayload): TBINormalizedWebhookPayload {
  return {
    application_id: raw.CreditApplicationId,
    order_id: raw.OrderId,
    status: raw.Message, // Message contains the actual status text
    status_code: raw.Status,
    reseller_code: raw.ResellerCode,
    system: raw.System,
    contract_number: raw.ContractNumber,
  };
}

// ============================================================================
// STATUS MAPPING
// ============================================================================

export type TBIStatus =
  | 'pending'
  | 'processing'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'expired';

/**
 * Map TBI's actual status strings to our application status
 *
 * Standard statuses: Draft, MP Sent, InProgress, InProgressAssessment,
 *   Approved, KYC, ContractSigning, Rejected, Canceled, ContractSigned, Paid
 *
 * BNPL statuses: in_progress, rejected, canceled, approved & signed, expired
 *
 * Webhook Message field values: "Approved", "MP Sent", "Rejected", "Canceled",
 *   "in_progress", "rejected", "canceled", "approved & signed", "expired"
 */
export function mapTBIStatus(tbiStatus: string): TBIStatus {
  if (!tbiStatus) return 'pending';

  // Normalize: lowercase and trim
  const normalized = tbiStatus.toLowerCase().trim();

  const statusMap: Record<string, TBIStatus> = {
    // Standard statuses
    'draft': 'pending',
    'mp sent': 'processing',
    'inprogress': 'processing',
    'inprogressassessment': 'processing',
    'approved': 'approved',
    'kyc': 'processing',
    'contractsigning': 'approved',
    'rejected': 'rejected',
    'canceled': 'cancelled',
    'contractsigned': 'completed',
    'paid': 'completed',

    // BNPL statuses
    'in_progress': 'processing',
    'approved & signed': 'completed',
    'expired': 'expired',
  };

  return statusMap[normalized] || 'pending';
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate amount is within TBI limits
 */
export function validateAmount(amountCents: number): { valid: boolean; error?: string } {
  const config = getTBIConfig();

  if (!amountCents || amountCents <= 0) {
    return { valid: false, error: 'Invalid amount' };
  }

  if (amountCents < config.minAmountCents) {
    return {
      valid: false,
      error: `Minimum amount is ${(config.minAmountCents / 100).toFixed(2)} ${config.currency}`,
    };
  }

  if (amountCents > config.maxAmountCents) {
    return {
      valid: false,
      error: `Maximum amount is ${(config.maxAmountCents / 100).toFixed(2)} ${config.currency}`,
    };
  }

  return { valid: true };
}

/**
 * Validate Bulgarian EGN (personal ID)
 */
export function validateEGN(egn: string): boolean {
  if (!/^\d{10}$/.test(egn)) {
    return false;
  }

  // EGN checksum validation
  const weights = [2, 4, 8, 5, 10, 9, 7, 3, 6];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += parseInt(egn[i], 10) * weights[i];
  }

  const checksum = sum % 11;
  const expectedCheckDigit = checksum === 10 ? 0 : checksum;

  return parseInt(egn[9], 10) === expectedCheckDigit;
}

/**
 * Validate Bulgarian phone number
 */
export function validateBulgarianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  // Accept Bulgarian mobile numbers (08X...) with 10-11 digits, or international format
  const mobileRegex = /^(0|00359|\+359)?[0-9]{8,10}$/;
  return mobileRegex.test(cleaned);
}
