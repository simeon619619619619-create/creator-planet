# TBI BNPL Integration - Implementation Plan

## Summary
Integrate TBI Bank Fusion Pay as a BNPL (Buy Now, Pay Later) payment option alongside Stripe. Students see installment preview on product pages ("from 18.56 EUR/month"), then redirect to TBI's page to complete the loan application. On approval, access is auto-granted.

## Current State
- All infrastructure exists (edge functions, components, migration, types, service layer)
- **BUT the code was built against assumed API responses, not the real API**
- Credentials confirmed working: `BJKZ` / `creatorclub`
- API returns EUR, 46 schemes, 3-48 months, 50-2499.99 EUR range

## Critical Fixes Needed (Code vs Real API)

### 1. GetCalculations response mismatch
**Problem:** `_shared/tbi.ts:getCalculations()` expects `{success, schemes: [{scheme_id, installment_count, monthly_amount, ...}]}` but TBI returns a **raw array**: `[{id, name, period, installment_factor, total_due_factor, nir, apr, amount_min, amount_max, currency}]`

**Fix:** Rewrite response parsing. Map `id` → `scheme_id`, `period` → `installment_count`, calculate `monthly_amount = amount * installment_factor`, calculate `total_amount = amount * total_due_factor`.

### 2. Currency: BGN → EUR
**Problem:** Config defaults to `'BGN'` with amounts in stotinki (cents). TBI is now in EUR mode.

**Fix:** Change currency to `'EUR'`, update min/max to EUR values (5000 cents = 50 EUR, 249999 cents = 2499.99 EUR). All amounts in the system should be EUR cents.

### 3. Amount format
**Problem:** Code sends `amountCents` to TBI but TBI expects EUR as a decimal number (e.g., `"500"` not `50000`).

**Fix:** Convert cents to EUR before API call: `amount = amountCents / 100`. Add `currency: "EUR"` to all requests.

### 4. RegisterApplication encryption
**Problem:** Code sends raw JSON but TBI requires AES encryption of the payload.

**Fix:** Add AES-256-CBC encryption function using the encryption key. Encrypt the JSON payload before sending. TBI's PHP reference uses: `openssl_encrypt($json, 'aes-256-cbc', $key, 0, $iv)`.

### 5. RegisterApplication request format
**Problem:** Code sends `{reseller_code, reseller_key, amount, scheme_id, customer, products, ...}` but TBI expects different field names and the items array format is `[{name, quantity, price}]`.

**Fix:** Match TBI's actual request format from docs. The response returns `{application_url, application_id, order_id}` not `{success, redirect_url}`.

### 6. Status mapping
**Problem:** Uses placeholder status strings. Real TBI statuses are: `"Approved"`, `"MP Sent"`, `"Rejected"`, `"Canceled"` (Standard) and `"in_progress"`, `"rejected"`, `"canceled"`, `"approved & signed"`, `"expired"` (BNPL).

**Fix:** Update `mapTBIStatus()` with real values.

### 7. Webhook payload format
**Problem:** Code expects `{application_id, order_id, status, ...}` but TBI sends `{CreditApplicationId, StatusUrl, OrderId, Status (number), Message, ResellerCode}`.

**Fix:** Map TBI's webhook fields to our format.

---

## Implementation Phases

### Phase 1: Fix Backend (Edge Functions + Shared Utils)
**Goal:** Make the API calls work correctly with real TBI endpoints.

#### Task 1.1: Fix `_shared/tbi.ts` configuration
- Change default reseller code to `'BJKZ'`
- Change currency to `'EUR'`
- Update min/max amounts: `minAmountCents: 5000` (50 EUR), `maxAmountCents: 249999` (2499.99 EUR)
- Remove `defaultCategoryId` (TBI doesn't require it for our account)

#### Task 1.2: Fix `_shared/tbi.ts` GetCalculations
- TBI returns raw array, not `{success, schemes}`
- Map response fields: `id` → `scheme_id`, `period` → `installment_count`
- Calculate amounts: `monthly_amount = Math.round(amount * installment_factor * 100)` (convert to cents)
- Calculate total: `total_amount = Math.round(amount * total_due_factor * 100)`
- Send amount as EUR decimal, not cents: `amount: amountCents / 100`
- Add `currency: "EUR"` to request

#### Task 1.3: Add AES encryption for RegisterApplication
- Implement AES-256-CBC encryption using Deno's Web Crypto API
- Use the encryption key from env: `TBI_ENCRYPTION_KEY`
- Encrypt the full JSON payload before sending
- Key format: the provided key is a string, may need to derive proper AES key from it

#### Task 1.4: Fix RegisterApplication request/response
- Send amount as EUR decimal
- Add `currency: "EUR"` to request
- Map items format: `[{name, quantity, price}]`
- Handle response: `{application_url}` → `redirect_url`
- If encryption required, send as `{data: encrypted_payload}`

#### Task 1.5: Fix status mapping with real TBI statuses
- Standard: `"Approved"` → approved, `"MP Sent"` → processing, `"Rejected"` → rejected, `"Canceled"` → cancelled
- BNPL: `"in_progress"` → processing, `"rejected"` → rejected, `"canceled"` → cancelled, `"approved & signed"` → completed, `"expired"` → expired

#### Task 1.6: Fix webhook payload parsing
- Map: `CreditApplicationId` → `application_id`, `OrderId` → `order_id`, `Message` → `status`, `Status` (number) → status code
- Webhook body for Standard: `{CreditApplicationId, StatusUrl, OrderId, Status: 0, Message: "Approved", ResellerCode}`
- Webhook body for BNPL: `{CreditApplicationId, StatusUrl, OrderId, Status: 1, Message: "in_progress", ResellerCode}`

### Phase 2: Apply Database Migration
**Goal:** Create the TBI tables in production.

#### Task 2.1: Review and fix migration
- Verify `029_tbi_integration.sql` matches current needs
- Currency column should default to `'EUR'` not `'BGN'`
- Min amounts should be in EUR cents
- Apply via Supabase MCP

### Phase 3: Deploy Edge Functions
**Goal:** Get all TBI edge functions deployed and working.

#### Task 3.1: Deploy updated edge functions
- Deploy `_shared/tbi.ts` (shared, deployed with each function)
- Deploy `tbi-calculator`
- Deploy `tbi-checkout`
- Deploy `tbi-webhook`
- Deploy `tbi-status-check`
- Deploy `tbi-cancel`
- Note: MCP deploy doesn't resolve `../_shared/` imports, so inline dependencies or deploy via CLI

### Phase 4: Fix Frontend Types & Service
**Goal:** Align frontend code with the corrected API responses.

#### Task 4.1: Fix `tbiTypes.ts`
- Update `TBI_CONFIG` with EUR values, correct URL
- Update `TBIInstallmentScheme` to match real response fields
- Add `installment_factor` and `total_due_factor` fields
- Update amount ranges

#### Task 4.2: Fix `tbiService.ts`
- Update `getInstallmentSchemes()` to pass correct params
- Fix response mapping from edge function
- Update `qualifiesForTBI()` thresholds for EUR
- Fix `formatInstallmentDisplay()` for EUR formatting

### Phase 5: Integrate into Community Landing Page
**Goal:** Add "Pay in Installments" option to paid communities.

#### Task 5.1: Add TBI installment preview to CommunityLandingPage
- In the pricing card (right sidebar), below the JoinButton
- Show: "or from XX.XX EUR/month with TBI Bank" with TBI logo
- Only show when: community is paid AND price >= 50 EUR AND `tbi_enabled = true`
- Clicking opens the TBI application modal

#### Task 5.2: Wire up TBIApplicationModal in CommunityLandingPage
- On click → open `TBIApplicationModal`
- Pass: productType, productId, productName, amountCents
- On success → redirect to status tracking page
- On cancel → close modal

#### Task 5.3: Add TBI status tracking route
- Route: `/tbi/status/:applicationId`
- Component: `TBIStatusTracker`
- Auto-polls for status updates
- On approval → redirect to community

### Phase 6: Enable for Testing
**Goal:** Test the full flow end-to-end.

#### Task 6.1: Enable TBI on a test community
- Set `tbi_enabled = true` on a paid community
- Verify calculator shows correct EUR installments
- Test the full flow: button → modal → TBI redirect → webhook → access

### Phase 7: i18n
**Goal:** Add Bulgarian translations for all TBI UI strings.

#### Task 7.1: Add translation keys
- Calculator labels, button text, status messages
- Error messages in Bulgarian
- Both `en.json` and `bg.json`

---

## Architecture Diagram

```
Student sees community page (€500)
    ↓
"or from 18.56 EUR/month" [TBI preview - GetCalculations]
    ↓
Student clicks → TBIApplicationModal opens
    ↓
Selects scheme (e.g. 12 months) → Enters personal data
    ↓
tbi-checkout Edge Function
  → Creates tbi_applications record
  → Calls TBI RegisterApplication (encrypted)
  → Returns redirect URL
    ↓
Student redirected to TBI Bank's page
  → Completes identity verification
  → Signs loan agreement
    ↓
TBI sends webhook to tbi-webhook
  → Updates tbi_applications.status
  → On "approved & signed": grants access (membership/enrollment)
    ↓
Student polls via TBIStatusTracker
  → Sees approval → redirected to community
```

## Environment Variables (Already Set)
```
TBI_RESELLER_CODE=BJKZ ✅
TBI_RESELLER_KEY=creatorclub ✅
TBI_ENCRYPTION_KEY=Ejrg9XF@FqgOvsg3fEgdDAzG5Tce0O42Np2DjONXiQs7FRck6XCf2MP5gC#o4vxOW1qXwlDLpi5v@ArLiK20wWVcfLU!EGnbk6mNq9KgRCs#xX#4aci!69vjjsY#L8ko ✅
```

## Risk & Open Questions

1. **Encryption format**: TBI's PHP uses `openssl_encrypt()` with AES-256-CBC. Need to verify exact IV/padding config. May need to ask TBI for a test endpoint or sample encrypted payload.
2. **Webhook URL**: Need to set `statusURL` in RegisterApplication to `https://znqesarsluytxhuiwfkt.supabase.co/functions/v1/tbi-webhook`
3. **No TBI test environment access**: We're working against production API. First real application will be a live loan.
4. **Encryption may not be required for GetCalculations**: Docs only mention encryption for RegisterApplication.
