# CA Firm Pro — Phase 4: Time Tracking, Reports & Income Tax

Built on Phase 1+2+3. Adds time tracking with live timer, advanced analytics with charts, income tax module, and CSV exports.

---

## 🆕 What's New in Phase 4

| Feature | Details |
|---|---|
| **Live Timer** | Start/stop timer on any task — auto-fills log form on stop |
| **Time Logging** | Log hours with start/end times, billable flag, hourly rate |
| **Auto-billing** | Billed amount = (duration ÷ 60) × hourly rate, computed on save |
| **Approval workflow** | Admin approves/rejects employee time entries |
| **Time reports** | Group by employee, client, or task; daily trend chart |
| **Income Tax Module** | All 7 ITR forms (ITR-1 through ITR-7) with statutory deadlines |
| **Advance Tax** | Q1–Q4 advance tax schedule auto-generated per AY |
| **Deductions tracking** | 80C, 80D, 80G, others — per client per AY |
| **ITR → Task** | One click creates a linked task from any ITR record |
| **Reports: Overview** | KPIs, pie chart, priority bar chart, completion trend line |
| **Reports: Productivity** | Per-employee tasks, completion rate, hours, billed amount |
| **Reports: Clients** | Per-client tasks, compliance, hours, billed amount |
| **CSV Export** | Download tasks, time entries, or clients as CSV |
| **Updated Layout** | 4-section sidebar: Core / CA Tools / Insights / Account |
| **PWA-ready** | Mobile-friendly layout, add-to-home-screen ready |

---

## 📁 New Files

### Backend
```
models/
  TimeEntry.js           ← Time logs with billable flag, auto-billing amount
  IncomeTax.js           ← ITR forms, advance tax schedule, deductions

controllers/
  time.controller.js     ← CRUD + approve/reject + aggregated reports
  itr.controller.js      ← ITR CRUD + task creation + upcoming deadlines
  reports.controller.js  ← Overview, productivity, clients, CSV export

routes/
  phase4.routes.js       ← All 3 new routers

server.js                ← Updated (add phase4 routes)
```

### Frontend
```
pages/
  TimeTrackingPage.jsx   ← Live timer + log modal + entry table + approve
  IncomeTaxPage.jsx      ← ITR records + advance tax + deductions modal
  ReportsPage.jsx        ← 3-tab reports with recharts + CSV export

components/
  Layout.jsx             ← Updated with Phase 4 nav links + section labels

App.jsx                  ← Updated with /time, /itr, /reports routes
```

---

## 🚀 Setup

### Step 1 — No new packages needed
Phase 4 uses existing mongoose aggregation and recharts (already installed).

### Step 2 — Copy files
```
backend/models/          ← Copy TimeEntry.js, IncomeTax.js
backend/controllers/     ← Copy time.controller.js, itr.controller.js, reports.controller.js
backend/routes/          ← Copy phase4.routes.js
backend/server.js        ← Replace with Phase 4 version

frontend/src/pages/      ← Copy TimeTrackingPage.jsx, IncomeTaxPage.jsx, ReportsPage.jsx
frontend/src/components/ ← Replace Layout.jsx
frontend/src/App.jsx     ← Replace with Phase 4 version
```

### Step 3 — Restart
```bash
cd backend  && npm run dev
cd frontend && npm run dev
```

### New pages
- `/time`    — Time Tracking (all roles)
- `/itr`     — Income Tax Tracker (Owner/Admin)
- `/reports` — Reports & Analytics (Owner/Admin)

---

## 🌐 New API Endpoints

### Time Tracking
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/time | All | List entries (employees see own) |
| POST | /api/time | All | Log time entry |
| PUT | /api/time/:id | All | Update entry |
| DELETE | /api/time/:id | All | Delete entry |
| PUT | /api/time/:id/approve | Admin | Approve/reject entry |
| GET | /api/time/report | Admin | Aggregated time report |

### Income Tax
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/itr | All | List ITR records |
| GET | /api/itr/forms | All | All ITR form types |
| GET | /api/itr/upcoming | All | Deadlines in next 60 days |
| POST | /api/itr | Admin | Create ITR record |
| PUT | /api/itr/:id | All | Update record |
| POST | /api/itr/:id/create-task | Admin | Create task from filing |
| DELETE | /api/itr/:id | Admin | Delete record |

### Reports
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/reports/overview | Admin | Full firm analytics |
| GET | /api/reports/productivity | Admin | Per-employee stats |
| GET | /api/reports/clients | Admin | Per-client stats |
| GET | /api/reports/export?type= | Admin | CSV download |

---

## 📊 ITR Forms Supported

| Form | Who Files | Deadline |
|------|-----------|---------|
| ITR-1 | Salaried, pension, 1 house | Jul 31 |
| ITR-2 | Capital gains, foreign income | Jul 31 |
| ITR-3 | Business/profession with accounts | Sep 30 |
| ITR-4 | Presumptive income (44AD/44ADA) | Jul 31 |
| ITR-5 | Partnership firms, LLPs | Sep 30 |
| ITR-6 | Companies | Sep 30 |
| ITR-7 | Trusts, institutions | Sep 30 |

## 📅 Advance Tax Dates (auto-generated)

| Quarter | Due Date | Cumulative % |
|---------|---------|-------------|
| Q1 | June 15 | 15% |
| Q2 | September 15 | 45% |
| Q3 | December 15 | 75% |
| Q4 | March 15 | 100% |

---

## 💡 Time Tracking Workflow

```
Employee opens Time Tracking page
        ↓
Selects task → clicks Start Timer
        ↓
Timer counts up live (HH:MM:SS)
        ↓
Clicks Stop & Log
        ↓
Form auto-fills with duration
Employee adds description + billable flag + rate
        ↓
Clicks Log Time → entry saved (status: pending)
        ↓
Admin reviews → Approve or Reject
        ↓
Approved entries → included in billing reports
```

---

## 🗺️ Full Feature Map (All 4 Phases)

```
Phase 1 — Multi-Tenancy + Security
  ✅ Firm registration & isolation
  ✅ Owner/Admin/Employee roles
  ✅ JWT auth, rate limiting, sanitization
  ✅ Live polling, toast notifications
  ✅ Form validation, skeleton loaders

Phase 2 — Subscriptions & Billing
  ✅ Razorpay checkout (UPI, cards, net banking)
  ✅ Plan limits enforced at API level
  ✅ GST invoices auto-generated & emailed
  ✅ Subscription cron (expire, 7-day warning)
  ✅ Billing dashboard + invoice history

Phase 3 — CA-Specific Features
  ✅ GST Calendar (GSTR-1, GSTR-3B, GSTR-9, etc.)
  ✅ Recurring task templates with placeholders
  ✅ File attachments (AWS S3 + local fallback)
  ✅ Client portal (separate login + task/doc view)
  ✅ WhatsApp notifications via Twilio

Phase 4 — Analytics & Tax
  ✅ Time tracking with live timer
  ✅ Billable hours + auto-billing calculation
  ✅ Approval workflow for time entries
  ✅ Income Tax module (all 7 ITR forms)
  ✅ Advance tax schedule per client/AY
  ✅ Reports: overview, productivity, clients
  ✅ Charts: pie, bar, line (recharts)
  ✅ CSV export for tasks, time, clients
```
