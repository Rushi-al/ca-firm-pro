# CA Firm Pro — Remaining Features (Security + Notifications + PDF + Sign-off)

This completes everything from the original roadmap that wasn't in Phases 1–4.

---

## ✅ What's Completed in This Package

| Feature | Status | Details |
|---|---|---|
| httpOnly cookies for JWT | ✅ Done | Refresh token in secure httpOnly cookie — XSS safe |
| Refresh token rotation | ✅ Done | Short-lived access (15min) + long-lived refresh (30 days) |
| Password strength | ✅ Done | Min 8 chars + uppercase + lowercase + number enforced |
| 2FA (TOTP) | ✅ Done | Google Authenticator compatible, no external library |
| Backup codes | ✅ Done | 8 one-time codes generated on 2FA enable |
| In-app notification bell | ✅ Done | Real-time unread count badge, auto-polls every 30s |
| Notification types | ✅ Done | 12 types: task assigned, deadline, GST, ITR, billing, etc |
| Weekly Monday summary email | ✅ Done | HTML email with stats + task table every Monday 7AM |
| Daily deadline notifications | ✅ Done | In-app + email at 7, 3, 1 days before deadline |
| PDF task report | ✅ Done | Dark-themed PDF with stats, full task table |
| PDF client summary | ✅ Done | Client info, tasks, GST filings, time billed |
| Client sign-off | ✅ Done | Admin requests → client approves/rejects in portal |
| CORS locked | ✅ Done | Locked to FRONTEND_URL only |
| Rate limiting | ✅ Done | 100/15min global, 20/15min for auth routes |
| Helmet security headers | ✅ Done | CSP configured for Razorpay |
| MongoDB sanitization | ✅ Done | express-mongo-sanitize + xss-clean |

---

## 📁 New Files

### Backend
```
models/
  Notification.js          ← 12 notification types, per-user, per-firm
  RefreshToken.js          ← Stored refresh tokens with auto-TTL expiry
  TwoFactor.js             ← TOTP secrets + backup codes

controllers/
  notification.controller.js  ← List, mark read, unread count, delete
  twofactor.controller.js     ← Setup QR, enable, disable, verify (no npm needed)
  auth.controller.js          ← Updated: httpOnly cookie, refresh rotation, 2FA flow
  pdf.controller.js           ← Task report + client summary PDF streaming
  signoff.controller.js       ← Request sign-off (Admin) + approve/reject (Client)

middleware/
  auth.middleware.js       ← Updated: reads short-lived access token

services/
  notification.service.js  ← Create/bulk-create notifications for each event
  pdf.service.js           ← pdfkit-based PDF generation (dark theme)
  weekly.cron.js           ← Monday 7AM weekly email + daily 8AM deadline notifications

routes/
  remaining.routes.js      ← All new routers + updated auth router

server.js                  ← Final v3.0 with all phases + cookie-parser
```

### Frontend
```
components/
  NotificationBell.jsx     ← Bell icon with unread count badge + dropdown panel
  PDFButton.jsx            ← Reusable PDF download button + usePDFDownload hook
  SignOffPanel.jsx          ← Client portal sign-off approval UI
  layout-additions.js      ← Instructions + updated nav links for Layout.jsx

context/
  AuthContext.jsx          ← Updated: sessionStorage access token + refresh cookie

services/
  api.js                   ← Updated: auto-refresh interceptor + withCredentials

pages/
  LoginPage.jsx            ← Updated: 2FA step UI + password validation
  TwoFactorPage.jsx        ← Setup QR code, enable, disable, backup codes

App.jsx                    ← Final: all 4 phases + /security route
```

---

## 🚀 Setup

### Step 1 — Install new packages
```bash
cd backend
npm install pdfkit cookie-parser
```

### Step 2 — Copy files
```
backend/models/           ← Copy Notification.js, RefreshToken.js, TwoFactor.js
backend/controllers/      ← Copy notification, twofactor, pdf, signoff controllers
backend/controllers/auth.controller.js  ← REPLACE (new secure auth)
backend/middleware/auth.middleware.js   ← REPLACE (short-lived token check)
backend/services/notification.service.js ← COPY
backend/services/pdf.service.js         ← COPY
backend/services/weekly.cron.js         ← COPY
backend/routes/remaining.routes.js      ← COPY
backend/server.js                       ← REPLACE (final v3.0)

frontend/src/services/api.js            ← REPLACE (auto-refresh)
frontend/src/context/AuthContext.jsx    ← REPLACE (sessionStorage + cookie)
frontend/src/pages/LoginPage.jsx        ← REPLACE (2FA flow)
frontend/src/pages/TwoFactorPage.jsx    ← COPY
frontend/src/components/NotificationBell.jsx ← COPY
frontend/src/components/PDFButton.jsx   ← COPY
frontend/src/components/SignOffPanel.jsx← COPY
frontend/src/App.jsx                    ← REPLACE (all routes)
```

### Step 3 — Update Layout.jsx
Add `import NotificationBell from './NotificationBell'` and place `<NotificationBell />` in the sidebar footer next to the user avatar. Add `/security` link and lock icon to nav links. See `layout-additions.js` for exact instructions.

### Step 4 — Add to Reports page (PDF export button)
```jsx
import { usePDFDownload, PDFButton } from '../components/PDFButton';

// Inside ReportsPage component:
const { downloadTaskReport, downloadClientSummary } = usePDFDownload();

// In the header area:
<PDFButton onClick={() => downloadTaskReport()} label="Download PDF" />
```

### Step 5 — Add to Clients page (client summary PDF)
```jsx
// In clients table row actions:
<PDFButton small onClick={() => downloadClientSummary(c._id, c.name)} label="PDF" />
```

### Step 6 — Wire sign-off in TasksPage
```jsx
// Admin: add "Request Sign-off" button on completed tasks
<button onClick={() => api.post(`/tasks/${task._id}/request-signoff`)}>
  Request Sign-off
</button>
```

### Step 7 — Wire sign-off in ClientPortalApp
```jsx
import { SignOffPanel } from '../components/SignOffPanel';

// In portal dashboard, after task list:
<SignOffPanel
  tasks={tasks.filter(t => t.signOff)}
  onSignOff={async (taskId, action, comment) => {
    const token = localStorage.getItem('portal_token');
    await fetch(`/api/portal/tasks/${taskId}/signoff`, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
      body: JSON.stringify({ action, comment }),
    });
    // reload tasks
  }}
/>
```

### Step 8 — Restart
```bash
cd backend  && npm run dev
cd frontend && npm run dev
```

---

## 🔐 Security Architecture (Final)

```
Login flow:
  1. POST /api/auth/login
     → Validates credentials
     → If 2FA enabled: returns tempToken (5min) → frontend shows OTP screen
     → If no 2FA: issues access token (15min) + sets refresh cookie (30 days)

  2. POST /api/auth/2fa/complete (if 2FA)
     → Validates TOTP code
     → Issues access token + refresh cookie

  3. Every API request:
     → Frontend sends: Authorization: Bearer <accessToken> (from sessionStorage)
     → Backend verifies short-lived token

  4. On 401 tokenExpired:
     → Frontend auto-calls POST /api/auth/refresh
     → Sends refresh cookie automatically (httpOnly, withCredentials)
     → Gets new access token
     → Retries failed request

  5. Logout:
     → POST /api/auth/logout
     → Revokes refresh token in DB
     → Clears cookie
     → Clears sessionStorage
```

```
2FA flow:
  Setup:  POST /api/auth/2fa/setup  → returns secret + otpauth URL
  Enable: POST /api/auth/2fa/enable → verify OTP → returns 8 backup codes
  Disable:POST /api/auth/2fa/disable → verify OTP → disables
  Login:  POST /api/auth/login → requires2FA flag → POST /api/auth/2fa/complete
```

---

## 🏁 Complete Feature Checklist

### Phase 1 — Multi-Tenancy ✅
- [x] Firm model with plan limits
- [x] firmId on every model + every query
- [x] Owner/Admin/Employee roles
- [x] Firm registration page
- [x] Tenant isolation middleware

### Phase 2 — Security ✅
- [x] Rate limiting (100/15min + 20/15min auth)
- [x] httpOnly cookies for refresh token
- [x] Password strength (8 chars + uppercase + number)
- [x] express-mongo-sanitize + xss-clean
- [x] helmet security headers
- [x] Refresh token rotation
- [x] TOTP 2FA (Google Authenticator)
- [x] CORS locked to frontend domain

### Phase 3 — Billing ✅
- [x] Razorpay checkout
- [x] GST invoices
- [x] Plan enforcement at API level
- [x] Subscription cron
- [x] Billing dashboard

### Phase 4 — Notifications ✅
- [x] Email reminders (7/3/1 day)
- [x] WhatsApp via Twilio
- [x] In-app notification bell
- [x] Weekly Monday summary email
- [x] Daily deadline notifications

### Phase 5 — Documents ✅
- [x] File uploads per task (S3 + local fallback)
- [x] Version history
- [x] PDF task report generation
- [x] PDF client summary generation

### Phase 6 — CA-Specific ✅
- [x] GST Calendar (7 return types)
- [x] ITR tracker (7 forms + advance tax)
- [x] Client portal (separate login)
- [x] Client sign-off on completed work
- [x] Time tracking + billable hours
- [x] Recurring task templates
- [x] Reports + CSV + PDF export
