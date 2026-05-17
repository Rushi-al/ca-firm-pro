# CA Firm Pro — Phase 2: Subscriptions & Billing

Built on top of Phase 1. Adds Razorpay payments, invoice generation, plan enforcement, and billing dashboard.

---

## 🆕 What's New in Phase 2

| Feature | Details |
|---|---|
| **Razorpay Checkout** | Native Razorpay popup — UPI, cards, net banking, wallets |
| **Payment Verification** | HMAC-SHA256 signature check — cannot be faked |
| **Subscription Model** | Full history of all plan changes per firm |
| **Invoice Generation** | Auto-generated with GST breakdown, downloadable as PDF |
| **Invoice Emails** | Sent immediately after payment via nodemailer |
| **Plan Enforcement** | API blocks employee/client creation when limits hit |
| **Expiry Cron** | Daily midnight job — downgrades expired plans, sends 7-day warnings |
| **Billing Dashboard** | Current plan, usage meters, invoice history, cancel button |
| **Pricing Page** | Public comparison page with monthly/yearly toggle |
| **Upgrade Emails** | Confirmation email on successful upgrade |
| **Cancel Flow** | Cancels at period end — retains access until expiry |
| **Webhook Handler** | Handles payment.failed and subscription.cancelled events |

---

## 🚀 Setup

### Step 1 — Get Razorpay Keys

1. Go to **dashboard.razorpay.com** → create free account
2. Settings → API Keys → Generate Test Key
3. Copy `Key ID` and `Key Secret`
4. Settings → Webhooks → Add webhook URL: `https://yourserver.com/api/billing/webhook`
5. Select events: `payment.failed`, `subscription.cancelled`
6. Copy the webhook secret

### Step 2 — Update .env

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### Step 3 — Install new dependency

```bash
cd backend
npm install razorpay
```

### Step 4 — Add Phase 2 files to your Phase 1 project

```
backend/
  models/Subscription.js      ← COPY
  models/Invoice.js           ← COPY
  models/Firm.js              ← REPLACE (adds PLANS export + new fields)
  controllers/billing.controller.js  ← COPY
  routes/billing.routes.js    ← COPY
  services/email.service.js   ← REPLACE (adds invoice/upgrade emails)
  services/subscription.cron.js ← COPY
  server.js                   ← REPLACE (adds billing route + webhook raw body)
  config/razorpay.js          ← COPY
  .env.example                ← REPLACE

frontend/src/
  pages/PricingPage.jsx       ← COPY
  pages/BillingPage.jsx       ← COPY
  App.jsx                     ← REPLACE (adds /pricing and /billing routes)
  components/Layout.jsx       ← ADD billing/pricing nav links (see below)
```

### Step 5 — Update Layout.jsx sidebar

Add to the `Ic` icons object:
```js
star:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
billing: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
```

Add to `adminLinks` array (before settings):
```js
{ to: '/pricing', label: 'Upgrade Plan', icon: Ic.star    },
{ to: '/billing',  label: 'Billing',      icon: Ic.billing },
```

---

## 💳 Payment Flow

```
User clicks "Upgrade to Pro"
        ↓
POST /api/billing/create-order
        ↓
Razorpay Checkout popup opens
        ↓
User pays (UPI / Card / Net Banking)
        ↓
Razorpay calls handler() with payment IDs
        ↓
POST /api/billing/verify-payment
  → HMAC-SHA256 signature verified
  → Firm.plan updated to 'pro'
  → Subscription record created
  → Invoice created (with GST)
  → Invoice email sent
  → Upgrade confirmation email sent
        ↓
User redirected to /billing
```

---

## 📋 Plan Limits Enforcement

Limits are enforced at the **API level** via `checkPlanLimit()` middleware:

```
POST /api/clients → checkPlanLimit('clients') → 403 if over limit
POST /api/users   → checkPlanLimit('employees') → 403 if over limit
```

The response when limit is hit:
```json
{
  "success": false,
  "message": "Your free plan allows max 20 clients. Please upgrade.",
  "data": { "limit": 20, "current": 20, "plan": "free" }
}
```

---

## 🪝 Webhook Events Handled

| Event | Action |
|---|---|
| `payment.failed` | Sets subscription status to `past_due` |
| `subscription.cancelled` | Sets firm planStatus to `cancelled` |

---

## 🗓️ Cron Jobs

| Job | Schedule | Action |
|-----|----------|--------|
| Subscription expiry | Daily midnight | Downgrades expired plans to free |
| Expiry warning | Daily midnight | Emails 7-day warning to firm owners |
| Deadline reminders | Daily 8AM | Task deadline emails to employees |

---

## 🌐 New API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/billing/plans | Public | All plan details & pricing |
| GET | /api/billing/overview | Owner | Current plan + invoices |
| POST | /api/billing/create-order | Owner | Create Razorpay order |
| POST | /api/billing/verify-payment | Owner | Verify & activate plan |
| POST | /api/billing/cancel | Owner | Cancel at period end |
| GET | /api/billing/invoices/:id | Owner | Single invoice |
| POST | /api/billing/webhook | Public* | Razorpay events |

*Webhook verified via HMAC signature

---

## 🧪 Testing Payments (Test Mode)

Use Razorpay test card:
- Card: `4111 1111 1111 1111`
- Expiry: any future date
- CVV: any 3 digits
- OTP: `1234` (for test mode)

UPI Test: `success@razorpay`

---

## 🗺️ What's Next — Phase 3

- GST filing calendar (GSTR-1, GSTR-3B deadlines auto-created as tasks)
- Recurring tasks (quarterly/annual auto-generation)
- File attachments per task (AWS S3)
- Client portal (read-only login for clients)
- WhatsApp notifications via Twilio
