import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Layout             from './components/Layout';
import LoginPage          from './pages/LoginPage';
import RegisterPage       from './pages/RegisterPage';
import AdminDash          from './pages/AdminDash';
import EmpDash            from './pages/EmpDash';
import ClientsPage        from './pages/ClientsPage';
import TasksPage          from './pages/TasksPage';
import EmployeesPage      from './pages/EmployeesPage';
import ActivityPage       from './pages/ActivityPage';
import FirmSettings       from './pages/FirmSettings';
import AIPage             from './pages/AIPage';
import PricingPage        from './pages/PricingPage';
import BillingPage        from './pages/BillingPage';
// Phase 3
import GSTCalendarPage    from './pages/GSTCalendarPage';
import RecurringTasksPage from './pages/RecurringTasksPage';
import ClientPortalPage   from './pages/ClientPortalPage';
import ClientPortalApp    from './pages/ClientPortalApp';
// Phase 4
import TimeTrackingPage   from './pages/TimeTrackingPage';
import IncomeTaxPage      from './pages/IncomeTaxPage';
import ReportsPage        from './pages/ReportsPage';
// Remaining
import TwoFactorPage      from './pages/TwoFactorPage';

function PrivateRoute({ children, roles = [] }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#020817]">
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
      {/* Public */}
      <Route path="/login"         element={<LoginPage />} />
      <Route path="/register"      element={<RegisterPage />} />
      <Route path="/client-portal" element={<ClientPortalApp />} />

      {/* Main app */}
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* Core */}
        <Route path="dashboard" element={user?.role === 'Employee' ? <EmpDash /> : <AdminDash />} />
        <Route path="clients"   element={<PrivateRoute roles={['Owner','Admin']}><ClientsPage /></PrivateRoute>} />
        <Route path="tasks"     element={<TasksPage />} />
        <Route path="employees" element={<PrivateRoute roles={['Owner','Admin']}><EmployeesPage /></PrivateRoute>} />
        <Route path="activity"  element={<PrivateRoute roles={['Owner','Admin']}><ActivityPage /></PrivateRoute>} />
        <Route path="ai"        element={<AIPage />} />
        <Route path="settings"  element={<PrivateRoute roles={['Owner']}><FirmSettings /></PrivateRoute>} />

        {/* Phase 2 */}
        <Route path="pricing"   element={<PricingPage />} />
        <Route path="billing"   element={<PrivateRoute roles={['Owner']}><BillingPage /></PrivateRoute>} />

        {/* Phase 3 */}
        <Route path="gst"       element={<PrivateRoute roles={['Owner','Admin']}><GSTCalendarPage /></PrivateRoute>} />
        <Route path="recurring" element={<PrivateRoute roles={['Owner','Admin']}><RecurringTasksPage /></PrivateRoute>} />
        <Route path="portal"    element={<PrivateRoute roles={['Owner','Admin']}><ClientPortalPage /></PrivateRoute>} />

        {/* Phase 4 */}
        <Route path="time"      element={<TimeTrackingPage />} />
        <Route path="itr"       element={<PrivateRoute roles={['Owner','Admin']}><IncomeTaxPage /></PrivateRoute>} />
        <Route path="reports"   element={<PrivateRoute roles={['Owner','Admin']}><ReportsPage /></PrivateRoute>} />

        {/* Remaining — Security */}
        <Route path="security"  element={<TwoFactorPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
