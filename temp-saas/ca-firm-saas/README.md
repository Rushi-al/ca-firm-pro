# CA Firm Pro — SaaS v2.0
### Multi-Tenant Practice Management System for Chartered Accountants

---

## 🏗️ What's New in v2.0 (Phase 1 — Multi-Tenancy)

| Feature | Details |
|---|---|
| **Multi-Tenancy** | Every firm's data is 100% isolated via `firmId` on every model |
| **Firm Registration** | Any CA firm can self-register at `/register` |
| **3-Tier Roles** | Owner → Admin → Employee (per firm) |
| **Plan Limits** | Free: 2 employees, 20 clients · Pro: 10 employees, unlimited |
| **Security** | helmet, rate-limiting, mongo-sanitize, xss-clean, bcrypt |
| **Email Reminders** | Daily 8AM cron — deadline reminders + admin summary |
| **Live Polling** | Dashboards poll every 20s, toast on data change |
| **Form Validation** | On-blur + on-submit with field-level error/success indicators |
| **Toast System** | Global slide-up notifications replace all alert() calls |
| **Charts** | Recharts pie (task distribution) + bar (employee workload) |
| **Skeleton Loaders** | Animated placeholders replace "Loading…" text |
| **Mobile Responsive** | Slide-in drawer sidebar on mobile |
| **Firm Settings** | Owner can edit firm profile, view plan usage, change password |
| **Activity Log** | Full feed of all firm actions, auto-refreshes every 30s |

---

## 🚀 Setup (Manual)

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### Backend
```bash
cd backend
npm install
cp .env.example .env        # Fill in MONGO_URI and JWT_SECRET
node seed.js                # Creates 2 demo firms with isolated data
npm run dev                 # http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

---

## 🚀 Setup (Antigravity — Recommended)

Open this folder in **Antigravity** and paste this prompt:

```
This is a multi-tenant SaaS app for CA firms.
Backend: Node.js + Express + MongoDB (folder: backend/)
Frontend: React + Vite + Tailwind + Recharts (folder: frontend/)

Please do the following:
1. Run npm install in /backend and /frontend
2. Copy backend/.env.example to backend/.env
3. Set MONGO_URI=mongodb://localhost:27017/ca-firm-saas
4. Set JWT_SECRET=supersecretkey123changeInProd
5. Make sure MongoDB is running locally
6. Run: cd backend && node seed.js
7. Start backend: cd backend && npm run dev
8. Start frontend: cd frontend && npm run dev
9. Open http://localhost:5173
```

---

## 👤 Demo Accounts (created by seed.js)

### Firm 1 — Mehta & Associates (Pro Plan)
| Role | Email | Password |
|------|-------|----------|
| Owner | priya@mehta.com | Admin@123 |
| Admin | arjun@mehta.com | Admin@123 |
| Employee | rajesh@mehta.com | Emp@12345 |
| Employee | anita@mehta.com | Emp@12345 |

### Firm 2 — Shah Tax Consultants (Free Plan)
| Role | Email | Password |
|------|-------|----------|
| Owner | owner@shah.com | Admin@123 |
| Employee | neha@shah.com | Emp@12345 |

> ⚡ Login with both firms to verify data isolation — each firm sees ONLY its own clients, tasks, and employees.

---

## 📁 Project Structure

```
ca-firm-saas/
├── backend/
│   ├── models/
│   │   ├── Firm.js          ← NEW: Core tenant model with plan limits
│   │   ├── User.js          ← firmId + Owner/Admin/Employee roles
│   │   ├── Client.js        ← firmId scoped
│   │   ├── Task.js          ← firmId scoped, auto-status from progress
│   │   └── ActivityLog.js   ← firmId scoped
│   ├── middleware/
│   │   └── auth.middleware.js  ← protect + tenantGuard + authorize + checkPlanLimit
│   ├── controllers/
│   │   ├── firm.controller.js   ← register, getMyFirm, updateFirm
│   │   ├── auth.controller.js   ← login, getMe, changePassword
│   │   ├── client.controller.js ← all queries use { firmId: req.firmId }
│   │   ├── task.controller.js   ← firmId scoped + stats
│   │   ├── user.controller.js   ← firmId scoped + plan limit checks
│   │   └── activity.controller.js
│   ├── routes/
│   │   ├── firm.routes.js
│   │   ├── auth.routes.js
│   │   └── index.js         ← client, task, user, activity routers
│   ├── services/
│   │   └── reminder.service.js  ← node-cron daily 8AM email reminders
│   ├── seed.js              ← Creates 2 fully isolated demo firms
│   └── server.js            ← helmet + rate-limit + sanitize + xss
│
└── frontend/
    └── src/
        ├── context/
        │   ├── AuthContext.jsx   ← stores user + firm
        │   └── ToastContext.jsx  ← global toast notifications
        ├── services/
        │   ├── api.js            ← axios with JWT interceptor
        │   └── validation.js     ← shared validation rules
        ├── components/
        │   ├── Layout.jsx        ← sidebar + mobile drawer + plan badge
        │   └── index.jsx         ← Modal, ConfirmModal, StatCard, Badge,
        │                            Skeleton, LiveDot, Field, EmptyState
        └── pages/
            ├── LoginPage.jsx     ← with field validation
            ├── RegisterPage.jsx  ← NEW: firm self-registration
            ├── AdminDash.jsx     ← charts + live polling + toast
            ├── EmpDash.jsx       ← live polling + overdue highlights
            ├── ClientsPage.jsx   ← CRUD + validation + toast + confirm
            ├── TasksPage.jsx     ← CRUD + search + filters + polling
            ├── EmployeesPage.jsx ← NEW: manage staff + plan limits
            ├── ActivityPage.jsx  ← NEW: activity feed + auto-refresh
            ├── FirmSettings.jsx  ← NEW: firm profile + plan usage + pw
            └── AIPage.jsx        ← Claude API with live firm context
```

---

## 🌐 API Reference

### Public (no auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/firms/register | Register new firm + owner |
| POST | /api/auth/login | Login (any role, any firm) |

### Protected (JWT required)
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | /api/auth/me | All | Current user + firm |
| PUT | /api/auth/change-password | All | Change password |
| GET | /api/firms/me | Owner, Admin | Firm details + usage |
| PUT | /api/firms/me | Owner | Update firm profile |
| GET | /api/clients | All | List firm's clients |
| POST | /api/clients | Owner, Admin | Create client |
| PUT | /api/clients/:id | Owner, Admin | Update client |
| DELETE | /api/clients/:id | Owner, Admin | Delete client |
| GET | /api/tasks | All | List tasks (employees see own) |
| GET | /api/tasks/stats | Owner, Admin | Dashboard stats |
| POST | /api/tasks | Owner, Admin | Create task |
| PUT | /api/tasks/:id | All | Update task |
| DELETE | /api/tasks/:id | Owner, Admin | Delete task |
| GET | /api/users | Owner, Admin | List firm employees |
| POST | /api/users | Owner, Admin | Add employee |
| PUT | /api/users/:id | Owner, Admin | Update employee |
| DELETE | /api/users/:id | Owner, Admin | Remove employee |
| GET | /api/activities | Owner, Admin | Activity logs |

---

## 🔒 Security Stack

| Layer | Tool | What it does |
|-------|------|-------------|
| HTTP headers | helmet | XSS, clickjacking, MIME protection |
| Rate limiting | express-rate-limit | 100 req/15min, 20 login attempts/15min |
| NoSQL injection | express-mongo-sanitize | Strips `$` and `.` from inputs |
| XSS | xss-clean | Sanitizes HTML in request bodies |
| Passwords | bcryptjs (12 rounds) | One-way hashing |
| Auth | JWT (7d expiry) | Stateless authentication |
| Tenant isolation | firmId on every query | Cross-firm data leakage impossible |
| Role guard | authorize() middleware | Owner > Admin > Employee enforcement |
| Plan limits | checkPlanLimit() middleware | Enforced at API level, not just UI |

---

## ⚙️ Environment Variables

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/ca-firm-saas
JWT_SECRET=minimum_32_character_random_secret_here
JWT_EXPIRES_IN=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Optional — email reminders (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM="CA Firm Pro <noreply@cafirmpro.com>"
```

---

## 🚢 Deploy with Antigravity

After testing locally, paste this into Antigravity:

```
Deploy this multi-tenant SaaS app to production:

1. Ask me for:
   - MongoDB Atlas connection string (MONGO_URI)
   - A strong JWT_SECRET (32+ random chars)
   - My Google Cloud project ID (for Cloud Run)

2. Backend → Google Cloud Run
   - Build Docker image from backend/
   - Set all env vars from .env.example
   - Deploy to Cloud Run (min 1 instance)

3. Frontend → Firebase Hosting or Vercel
   - Run: cd frontend && npm run build
   - Set VITE_API_URL to the Cloud Run backend URL
   - Deploy frontend/dist

4. After deploy:
   - Run seed.js once against the Atlas DB to create demo data
   - Test both firm logins to verify tenant isolation
   - Share the live URL with me
```

---

## 🗺️ Roadmap

- **Phase 2** — Razorpay subscriptions, billing dashboard
- **Phase 3** — GST filing calendar, auto-recurring tasks
- **Phase 4** — File attachments (AWS S3), document versioning
- **Phase 5** — WhatsApp alerts, client portal, time tracking
- **Phase 6** — Mobile app (React Native)
