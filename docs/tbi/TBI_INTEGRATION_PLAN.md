# TBI Bank Fusion Pay Integration Plan

## Overview
Integrate TBI Bank as a consumer financing option alongside existing Stripe payments, allowing students to pay for courses/communities in installments.

## Architecture

### Payment Flow Comparison

| Stripe | TBI Bank |
|--------|----------|
| Immediate payment | Application-based financing |
| Credit card / SEPA | POS loans / BNPL |
| Synchronous | Asynchronous (5 min - 5 days) |
| Webhook confirmation | Status polling + callback URL |
| Instant access | Access after TBI approval |

## Database Changes

### 1. communities table
```sql
ALTER TABLE communities ADD COLUMN IF NOT EXISTS tbi_enabled BOOLEAN DEFAULT false;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS tbi_min_amount_cents INTEGER DEFAULT 20000; -- 200 BGN minimum
```

### 2. New table: tbi_applications
```sql
CREATE TABLE tbi_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  community_id UUID REFERENCES communities(id),
  course_id UUID REFERENCES courses(id),
  buyer_id UUID REFERENCES profiles(id) NOT NULL,
  creator_id UUID REFERENCES profiles(id) NOT NULL,
  membership_id UUID REFERENCES memberships(id),
  enrollment_id UUID REFERENCES enrollments(id),

  -- TBI Application Data
  tbi_application_id VARCHAR(255), -- TBI's internal ID
  tbi_order_id VARCHAR(255) UNIQUE, -- Our order reference

  -- Financial
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'BGN',
  scheme_id INTEGER REFERENCES tbi_installment_schemes(scheme_id),
  downpayment_cents INTEGER DEFAULT 0,
  monthly_installment_cents INTEGER,
  installment_count INTEGER,
  total_amount_cents INTEGER,

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, approved, rejected, cancelled, completed, expired
  tbi_status VARCHAR(50), -- TBI's internal status
  rejection_reason TEXT,

  -- Customer data (EGN stored as hash only!)
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_first_name VARCHAR(100),
  customer_last_name VARCHAR(100),
  customer_egn_hash VARCHAR(255), -- SHA-256 hash of EGN

  -- URLs and tracking
  status_url VARCHAR(500),
  redirect_url VARCHAR(500),
  success_url VARCHAR(500),
  cancel_url VARCHAR(500),

  -- Callback tracking
  callback_received_at TIMESTAMPTZ,
  callback_payload JSONB,
  last_status_check_at TIMESTAMPTZ,

  -- Access control
  access_granted BOOLEAN DEFAULT false,
  access_granted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);
```

### 3. New table: tbi_installment_schemes (cached)
```sql
CREATE TABLE tbi_installment_schemes (
  id SERIAL PRIMARY KEY,
  scheme_id INTEGER UNIQUE NOT NULL,
  name VARCHAR(100),
  installment_count INTEGER NOT NULL,
  interest_rate DECIMAL(5,2),
  apr DECIMAL(5,2),
  min_amount_cents INTEGER,
  max_amount_cents INTEGER,
  is_promo BOOLEAN DEFAULT false,
  category_id INTEGER,

  -- Cache metadata
  reseller_code VARCHAR(50),
  cached_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);
```

### 4. New table: tbi_webhook_events (idempotency)
```sql
CREATE TABLE tbi_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tbi_event_id VARCHAR(255) UNIQUE NOT NULL,
  application_id UUID REFERENCES tbi_applications(id),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  processing_result VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## File Structure

```
src/
├── features/
│   └── billing/
│       ├── tbiService.ts               # ✅ Client-side TBI service
│       ├── tbiTypes.ts                 # ✅ TypeScript types
│       └── components/
│           ├── TBICalculator.tsx       # ✅ Installment calculator UI
│           ├── TBIButton.tsx           # ✅ "Buy in Installments" button
│           ├── TBIApplicationModal.tsx # ✅ Application flow
│           └── TBIStatusTracker.tsx    # ✅ Status polling component
└── supabase/
    ├── migrations/
    │   └── 029_tbi_integration.sql     # ✅ Database migration
    └── functions/
        ├── tbi-calculator/             # ✅ Get installment schemes
        ├── tbi-checkout/               # ✅ Create TBI application
        ├── tbi-webhook/                # ✅ Handle TBI callbacks
        ├── tbi-status-check/           # ✅ Poll for status updates
        ├── tbi-cancel/                 # ✅ Cancel application
        └── _shared/
            └── tbi.ts                  # ✅ Shared TBI config & helpers
```

## Implementation Phases

### Phase 1: Backend Infrastructure ✅
- [x] 1. Create database migrations (`tbi_applications`, `tbi_installment_schemes`, `tbi_webhook_events` tables)
- [x] 2. Implement `tbi-calculator` Edge Function
- [x] 3. Implement `tbi-checkout` Edge Function
- [x] 4. Implement `tbi-webhook` Edge Function
- [x] 5. Implement `tbi-status-check` Edge Function
- [x] 6. Implement `tbi-cancel` Edge Function
- [x] 7. Add TBI configuration & helpers to `_shared/tbi.ts`

### Phase 2: Frontend Components ✅
- [x] 1. Create TBI service layer (`tbiService.ts`)
- [x] 2. Build calculator component (`TBICalculator.tsx`)
- [x] 3. Build button component (`TBIButton.tsx`)
- [x] 4. Build application modal (`TBIApplicationModal.tsx`)
- [x] 5. Build status tracker (`TBIStatusTracker.tsx`)

### Phase 3: Integration ⏳
- [ ] 1. Add TBI button to community/course checkout pages
- [ ] 2. Implement payment method selector (Stripe vs TBI)
- [ ] 3. Handle access granting on TBI approval
- [ ] 4. Add "My Applications" page for users
- [ ] 5. Add admin dashboard for TBI applications

### Phase 4: Testing & Polish ⏳
- [ ] 1. Test calculator caching
- [ ] 2. Test full application flow
- [ ] 3. Test webhook handling
- [ ] 4. Test edge cases (rejection, timeout, cancellation)

## Environment Variables

### Required Supabase Secrets
Set these using `npx supabase secrets set`:

```bash
# TBI API credentials (get from TBI Bank)
TBI_RESELLER_CODE=CREATORCLUB
TBI_RESELLER_KEY=<your-reseller-key>

# Optional: Webhook signature verification
TBI_WEBHOOK_SECRET=<your-webhook-secret>

# Optional: For payload encryption if TBI requires it
TBI_ENCRYPTION_KEY=<your-encryption-key>
```

### Optional Frontend Variables
If you want to customize the client-side config:

```bash
# In .env
VITE_TBI_RESELLER_CODE=CREATORCLUB
VITE_TBI_API_URL=https://api.tbibank.bg/fusionpay/v1
```

## Security Considerations

1. **EGN Handling**: EGN (Bulgarian personal ID) is NEVER stored in plain text. Only SHA-256 hash is stored for auditing.
2. **Secrets**: All TBI API credentials stored in Supabase secrets, never exposed to client
3. **Webhook Verification**: Signature verification on all incoming webhooks (when TBI_WEBHOOK_SECRET configured)
4. **Idempotency**: Webhook events are deduplicated using `tbi_webhook_events` table
5. **Data Privacy**: Only essential customer data sent to TBI
6. **RLS Policies**: Users can only view their own applications, creators can view applications for their products

## TBI API Endpoints

### GetCalculations
```
POST https://api.tbibank.bg/fusionpay/v1/GetCalculations
Content-Type: application/json

{
  "reseller_code": "CREATORCLUB",
  "reseller_key": "***",
  "amount": 50000,  // in stotinki (500 BGN)
  "category_id": 1
}
```

### RegisterApplication
```
POST https://api.tbibank.bg/fusionpay/v1/RegisterApplication
Content-Type: application/json

{
  "reseller_code": "CREATORCLUB",
  "reseller_key": "***",
  "amount": 50000,
  "scheme_id": 472,
  "downpayment": 0,
  "order_id": "CC-XXXXX-XXXX",
  "customer": {
    "first_name": "...",
    "last_name": "...",
    "email": "...",
    "phone": "...",
    "egn": "..."
  },
  "products": [...],
  "success_url": "...",
  "failure_url": "...",
  "status_url": "..."  // Webhook URL
}
```

### GetApplicationStatus
```
POST https://api.tbibank.bg/fusionpay/v1/GetApplicationStatus
Content-Type: application/json

{
  "reseller_code": "CREATORCLUB",
  "reseller_key": "***",
  "application_id": "...",  // or order_id
  "order_id": "..."
}
```

### CancelApplication
```
POST https://api.tbibank.bg/fusionpay/v1/CancelApplication
Content-Type: application/json

{
  "reseller_code": "CREATORCLUB",
  "reseller_key": "***",
  "application_id": "...",
  "order_id": "..."
}
```

## Cost Analysis

| Factor | Impact |
|--------|--------|
| TBI Commission | ~2-5% per transaction (paid by merchant) |
| Minimum Amount | 200 BGN |
| Maximum Amount | 10,000 BGN |
| Payout | Next business day to merchant account |
| Chargeback Risk | Borne by TBI (big advantage!) |

## Success Metrics

- Conversion rate increase for high-ticket items (>200 BGN)
- Average order value increase
- Application approval rate
- Time to access (application → approval → access)

## Usage Examples

### Adding TBI Button to Checkout

```tsx
import { TBIButton } from '@/features/billing/components/TBIButton';
import { TBIApplicationModal } from '@/features/billing/components/TBIApplicationModal';

function CommunityCheckout({ community }) {
  const [showTBIModal, setShowTBIModal] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState(null);

  return (
    <>
      {/* Show TBI option if price qualifies */}
      {community.tbi_enabled && community.price_cents >= 20000 && (
        <TBIButton
          amountCents={community.price_cents}
          productName={community.name}
          productType="community"
          productId={community.id}
          onClick={() => setShowTBIModal(true)}
        />
      )}

      <TBIApplicationModal
        isOpen={showTBIModal}
        onClose={() => setShowTBIModal(false)}
        productType="community"
        productId={community.id}
        productName={community.name}
        amountCents={community.price_cents}
        onSuccess={() => {
          // Redirect to status tracking
          navigate(`/tbi/status/${applicationId}`);
        }}
      />
    </>
  );
}
```

### Tracking Application Status

```tsx
import { TBIStatusTracker } from '@/features/billing/components/TBIStatusTracker';

function TBIStatusPage({ applicationId }) {
  return (
    <TBIStatusTracker
      applicationId={applicationId}
      onStatusChange={(status) => console.log('Status:', status)}
      onComplete={() => {
        // Redirect to content
        navigate('/courses');
      }}
      pollInterval={30000} // Check every 30 seconds
    />
  );
}
```
