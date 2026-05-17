// ── ADD THESE ROUTES to App.jsx inside the "/" layout route ──
//
// import PricingPage from './pages/PricingPage';
// import BillingPage from './pages/BillingPage';
//
// Inside <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>:
//
//   <Route path="pricing" element={<PricingPage />} />
//
//   <Route path="billing" element={
//     <PrivateRoute roles={['Owner']}>
//       <BillingPage />
//     </PrivateRoute>
//   } />
//
// Also update Layout.jsx sidebar adminLinks to include:
//   { to: '/pricing', label: 'Upgrade Plan', icon: Ic.star    }
//   { to: '/billing',  label: 'Billing',      icon: Ic.billing }
//
// And add to the Ic icon map in Layout.jsx:
//   star:    <svg>...</svg>  (star/sparkle icon)
//   billing: <svg>...</svg>  (credit card icon)

// ─────────────────────────────────────────────────────────────
// FULL UPDATED App.jsx (copy this entire file)
// ─────────────────────────────────────────────────────────────
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Layout         from './components/Layout';
import LoginPage      from './pages/LoginPage';
import RegisterPage   from './pages/RegisterPage';
import AdminDash      from './pages/AdminDash';
import EmpDash        from './pages/EmpDash';
import ClientsPage    from './pages/ClientsPage';
import TasksPage      from './pages/TasksPage';
import EmployeesPage  from './pages/EmployeesPage';
import ActivityPage   from './pages/ActivityPage';
import FirmSettings   from './pages/FirmSettings';
import AIPage         from './pages/AIPage';
import PricingPage    from './pages/PricingPage';
import BillingPage    from './pages/BillingPage';

function PrivateRoute({ children, roles = [] }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles.length && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  useEffect(() => { document.title = 'CA Firm Pro'; }, []);

  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />

        <Route path="dashboard" element={
          user?.role === 'Employee' ? <EmpDash /> : <AdminDash />
        } />
        <Route path="clients" element={<PrivateRoute roles={['Owner','Admin']}><ClientsPage /></PrivateRoute>} />
        <Route path="tasks"   element={<TasksPage />} />
        <Route path="employees" element={<PrivateRoute roles={['Owner','Admin']}><EmployeesPage /></PrivateRoute>} />
        <Route path="activity"  element={<PrivateRoute roles={['Owner','Admin']}><ActivityPage /></PrivateRoute>} />
        <Route path="settings"  element={<PrivateRoute roles={['Owner']}><FirmSettings /></PrivateRoute>} />
        <Route path="ai"        element={<AIPage />} />

        {/* ── Phase 2: Billing ── */}
        <Route path="pricing" element={<PricingPage />} />
        <Route path="billing" element={<PrivateRoute roles={['Owner']}><BillingPage /></PrivateRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
