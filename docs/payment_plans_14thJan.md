Go over creator club project setup below:

---

# 1) Плащания (как точно минават парите)

## A) Студентите плащат към ТЕБ (KINGDOM LTD) през Stripe ✅ DONE

* Ти си "платформата/merchant" и контролираш checkout-а.
* Всички плащания минават през твоя Stripe.

**Implementation:**
- Stripe account: `acct_1SoV6VEHrm7Q2JIn` (KINGDOM LTD)
- Edge functions: `stripe-checkout`, `community-checkout`, `student-plus-checkout`
- All payments collected by platform first

## B) Криейтърите се изплащат през Stripe Connect Express ✅ DONE

* Creator натиска **"Connect Payouts"**
* Вкарва IBAN и минава KYC
* Получава "Active" статус

**Implementation:**
- Edge function: `stripe-connect` (creates Express accounts, onboarding links)
- UI: `CreatorSettings.tsx` with "Connect Payouts" button
- Status tracking in `creator_billing.stripe_connect_status`

---

# 2) Какво продавате

## 2.1 Membership (subscription) – първо това ✅ DONE

* Студентът плаща месечен абонамент към конкретен creator.
* На всяко плащане ти взимаш  **platform fee %** .

**Implementation:**
- Community memberships with `pricing_type: 'monthly'`
- Platform fee calculated per creator's plan tier (6.9% / 3.9% / 1.9%)
- `creator_sales` table tracks each sale with fee

## 2.2 One-time дигитални продукти (по-късно) ✅ DONE

* Еднократно плащане за продукт/курс.

**Implementation:**
- Community memberships with `pricing_type: 'one_time'`
- `community-checkout` edge function handles both types

---

# 3) Payout правила (точните срокове)

Това е сърцето. Сетваш го така:

## Pending → Available: **7 дни** ✅ DONE

* Всичко, което се плати днес = **Pending 7 дни**
* След 7 дни става **Available** за теглене/изплащане

👉 Това е "OnlyFans vibe" и ти дава buffer.

**Implementation:**
- `pending_balances` table with `release_at = NOW() + INTERVAL '7 days'`
- `release-pending-balances` edge function (daily cron at 6:00 AM UTC)
- GitHub Actions workflow: `.github/workflows/balance-crons.yml`

---

## Изплащания: **1 път седмично (петък)** ✅ DONE

* Всеки петък изплащаш само:

**  **✅ **Available balance**

**  **✅ **над минималния праг**

**Implementation:**
- `process-payouts` edge function (Friday cron at 9:00 AM UTC)
- Filters creators with `available_balance_cents >= 5000` (€50)
- Creates Stripe transfers to Connect accounts

---

## Minimum withdrawal: **€50** ✅ DONE

* Ако имат €49 — чакат.
* Ако имат €50+ — влизат в payout-а.

**Това е най-добрият баланс.**

€20 е прекалено дребно (оперативен хаос), €100 е твърде високо (ядосани криейтъри).

**Implementation:**
- Constant: `MIN_WITHDRAWAL_CENTS = 5000` (€50)
- Checked in both `creator-withdrawal` and `process-payouts`

---

## Cooldown между manual withdrawals (ако позволяваш manual) ✅ DONE

Ако дадеш бутон "Withdraw", сложи:

* **1 теглене на 72 часа (3 дни)**

Ако payouts са само автоматични weekly — cooldown НЕ ти трябва.

**Implementation:**
- `creator_billing.last_payout_at` timestamp
- `creator-withdrawal` checks: `last_payout_at + 72 hours > NOW()`
- UI: `WithdrawalModal.tsx` shows cooldown countdown

---

# 4) Anti-fail защита (ако има chargeback след 3 месеца)

Това е ситуацията, която те притеснява. Решението е  **винаги едно и също** :

## Правило: "Creator носи риска за chargeback след payout" ✅ DONE

Тоест:

* ако след 3 месеца има chargeback,
* платформата връща парите на клиента,
* **а ти си ги взимаш обратно от creator-а** чрез:

### A) Clawback / Reverse transfer ✅ DONE

Ако има налични пари в creator акаунта → връщаш сумата.

**Implementation:**
- `handleDisputeCreated()` in `stripe-webhook`
- Deduction order: available_balance → reserved_balance → negative_balance
- `balance_transactions` logs each deduction

### B) Negative balance ✅ DONE

Ако creator вече е изтеглил всичко → става  **на минус** .

И тогава:

* **следващите му приходи първо покриват минуса**
* докато минусът не стане 0 → **няма payouts**

✅ Това е реалната "броня", която използват големите платформи.

**Implementation:**
- `creator_billing.negative_balance_cents` column
- `process-payouts` clears negative balance before payout calculation
- New sales first cover negative balance, then add to pending

---

# 5) Rolling Reserve (задължително за да не гръмнеш)

Само 7-дневен hold НЕ стига, защото chargeback може да се появи след много време.

Затова сетваш:

## New / рискови creators: ✅ DONE

* **10% reserve**
* за **120 дни**

**Implementation:**
- 10% of each sale goes to `reserved_balance_cents`
- `reserve_releases` table schedules release at `+120 days`
- `release-pending-balances` also processes reserve releases

## Trusted creators: ⚠️ PARTIAL

* **0–5% reserve**
* или 0 ако са стабилни

Reserve = "застраховка", която държиш, ако стане chargeback по-късно.

**Implementation:**
- Schema supports variable reserve percentage
- **TODO:** Add `is_trusted` flag or trust score to `creator_billing`
- **TODO:** Admin UI to mark creators as trusted
- **TODO:** Variable reserve % based on trust level

---

# 6) Refund Policy (как го сетваш без да те изядат)

Ти каза "не искам refunds".

Реалистичното (работещо) решение е:

## Membership (subscription) ⏳ NOT YET (policy only)

✅ **No refunds за текущия период**

* Може да cancel-нат, но важи за следващия период.

**Option (ако искаш да намалиш chargeback-и):**

* 24ч "grace" само за първо плащане и само ако не е консумирано много.

**Implementation status:**
- **DONE:** Cancellation logic exists (Stripe portal)
- **TODO:** Enforce "no refunds" in webhook (reject refund requests)
- **TODO:** 24h grace period option for first payment

## One-time продукт (по-късно) ⏳ NOT YET

* "No refunds след предоставен достъп"
* * checkbox на checkout (че започва веднага)

**    **Това е важно за ЕС политика при дигитално съдържание.

**Implementation status:**
- **TODO:** Add EU digital content checkbox to checkout
- **TODO:** Store consent timestamp in `community_purchases`

---

# 7) Контент защита (да е "protected" и smooth)

Тук ще съм брутално честен:

❌ **НЕ можеш 100% да спреш screen recording** на всички устройства.

Но можеш да го направиш  **достатъчно трудно + рисково** , за да не си заслужава.

### MVP защита (smooth + ефективна) ⏳ NOT YET

* **Streaming only** (без download линкове)
* **Signed URLs** (кратък живот)
* **Dynamic watermark** (username/email + дата/час върху видеото)

**Implementation status:**
- **TODO:** Video hosting integration (Mux, Cloudflare Stream, or Bunny)
- **TODO:** Signed URL generation edge function
- **TODO:** Watermark overlay (could use video player overlay or transcoding)

### Next level (ако станете големи) ⏳ FUTURE

* DRM (Widevine/FairPlay)

**Implementation status:**
- Future phase, requires premium video hosting

---

# Финален "настрой го така" (копи-пейст)

Ето ти финалните стойности:

| Setting | Value | Status |
|---------|-------|--------|
| Pending period | 7 days | ✅ DONE |
| Payout frequency | Weekly (Friday) | ✅ DONE |
| Minimum withdrawal | €50 | ✅ DONE |
| Manual withdrawal cooldown | 72 hours | ✅ DONE |
| New creator reserve | 10% for 120 days | ✅ DONE |
| Trusted creator reserve | 0-5% | ⚠️ PARTIAL |
| Chargeback handling | Clawback + negative balance | ✅ DONE |
| Refund policy enforcement | No auto-refunds | ⏳ TODO |
| EU checkout consent | Digital content checkbox | ⏳ TODO |
| Content protection | Streaming + signed URLs + watermark | ⏳ TODO |

---

# Implementation Summary

## ✅ FULLY DONE (8 items)
1. Payment flow through KINGDOM LTD Stripe
2. Stripe Connect Express for creator payouts
3. Membership subscriptions with platform fees
4. One-time product payments
5. 7-day pending period
6. Weekly Friday payouts
7. €50 minimum withdrawal
8. 72-hour manual withdrawal cooldown
9. Chargeback clawback from available balance
10. Negative balance system
11. 10% rolling reserve for 120 days

## ⚠️ PARTIAL (1 item)
1. Trusted creator variable reserve (schema ready, needs admin UI + logic)

## ⏳ NOT YET (4 items)
1. Refund policy enforcement (block auto-refunds)
2. EU digital content checkout checkbox
3. Video content protection (streaming, signed URLs, watermark)
4. DRM (future phase)

---

# Key Files Reference

| Feature | Files |
|---------|-------|
| Balance System | `supabase/migrations/026_balance_system.sql` |
| Pending Release | `supabase/functions/release-pending-balances/index.ts` |
| Manual Withdrawal | `supabase/functions/creator-withdrawal/index.ts` |
| Auto Payouts | `supabase/functions/process-payouts/index.ts` |
| Chargeback Handling | `supabase/functions/stripe-webhook/index.ts` (handleDisputeCreated/Closed) |
| Cron Jobs | `.github/workflows/balance-crons.yml` |
| Balance UI | `src/features/billing/components/BalanceCard.tsx` |
| Withdrawal UI | `src/features/billing/components/WithdrawalModal.tsx` |
