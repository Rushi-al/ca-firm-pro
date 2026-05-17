import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmModal, PlanBadge, Skeleton } from '../components/index.jsx';

const fmt     = p => `₹${(p / 100).toLocaleString('en-IN')}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

const PLAN_FEATURES = {
  free:       { employees: 2,       clients: 20,       label: 'Free',       color: 'text-slate-400'  },
  pro:        { employees: 10,      clients: 'Unlimited', label: 'Pro',     color: 'text-amber-400'  },
  enterprise: { employees: 'Unlimited', clients: 'Unlimited', label: 'Enterprise', color: 'text-purple-400' },
};

export default function BillingPage() {
  const { firm }   = useAuth();
  const { toast }  = useToast();
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [confirm,  setConfirm]  = useState(false);

  useEffect(() => {
    document.title = 'Billing | CA Firm Pro';
    load();
  }, []);

  const load = () => {
    api.get('/billing/overview')
      .then(r => setData(r.data.data))
      .finally(() => setLoading(false));
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await api.post('/billing/cancel');
      toast(res.data.message, 'info');
      setConfirm(false);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to cancel.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const downloadInvoice = (invoice) => {
    // Build printable HTML invoice
    const html = `
      <!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>${invoice.invoiceNumber}</title>
      <style>
        body{font-family:sans-serif;max-width:700px;margin:40px auto;color:#111;padding:20px}
        .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px}
        .logo{font-size:24px;font-weight:900;color:#f59e0b}
        .badge{background:#dcfce7;color:#166534;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700}
        table{width:100%;border-collapse:collapse;margin:24px 0}
        th{text-align:left;background:#f1f5f9;padding:10px 12px;font-size:12px;text-transform:uppercase}
        td{padding:10px 12px;border-bottom:1px solid #e2e8f0}
        .total-row{font-weight:700;font-size:16px}
        @media print{button{display:none}}
      </style></head><body>
      <div class="header">
        <div>
          <div class="logo">CA Firm Pro</div>
          <p style="color:#64748b;margin-top:4px">Practice Management System</p>
        </div>
        <div style="text-align:right">
          <p style="font-size:20px;font-weight:700;color:#f59e0b">${invoice.invoiceNumber}</p>
          <p style="color:#64748b;font-size:13px">Date: ${fmtDate(invoice.paidAt)}</p>
          <span class="badge">PAID</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px">
        <div>
          <p style="font-size:11px;color:#64748b;text-transform:uppercase;margin-bottom:6px">From</p>
          <p style="font-weight:700">CA Firm Pro</p>
        </div>
        <div>
          <p style="font-size:11px;color:#64748b;text-transform:uppercase;margin-bottom:6px">Billed To</p>
          <p style="font-weight:700">${invoice.firmName}</p>
          ${invoice.firmGstin ? `<p style="color:#64748b;font-size:13px">GSTIN: ${invoice.firmGstin}</p>` : ''}
          <p style="color:#64748b;font-size:13px">${invoice.firmEmail}</p>
        </div>
      </div>
      <table>
        <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>
          ${invoice.items.map(i => `<tr><td>${i.description}</td><td style="text-align:right">${fmt(i.total)}</td></tr>`).join('')}
          <tr><td style="color:#64748b">Subtotal</td><td style="text-align:right">${fmt(invoice.subtotal)}</td></tr>
          <tr><td style="color:#64748b">GST (${invoice.taxRate}%)</td><td style="text-align:right">${fmt(invoice.taxAmount)}</td></tr>
          <tr class="total-row" style="background:#f8fafc"><td>Total</td><td style="text-align:right;color:#f59e0b">${fmt(invoice.total)}</td></tr>
        </tbody>
      </table>
      <p style="color:#94a3b8;font-size:12px">Payment ID: ${invoice.razorpayPaymentId}</p>
      <button onclick="window.print()" style="margin-top:20px;background:#f59e0b;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer">Print / Save as PDF</button>
      </body></html>
    `;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  if (loading) return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-48 mb-7" />
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  const pf = PLAN_FEATURES[data?.plan] || PLAN_FEATURES.free;
  const isActive = data?.plan !== 'free' && data?.planStatus === 'active';
  const isCancelled = data?.planStatus === 'cancelled';
  const daysLeft = data?.planExpiresAt
    ? Math.max(0, Math.ceil((new Date(data.planExpiresAt) - Date.now()) / 864e5))
    : null;

  return (
    <>
      <div className="flex justify-between items-center mb-7 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 mb-0.5">Billing & Subscription</h1>
          <p className="text-sm text-slate-500">Manage your plan, payments, and invoices</p>
        </div>
        <Link to="/pricing" className="btn-primary">Upgrade Plan →</Link>
      </div>

      {/* Current Plan Card */}
      <div className={`card mb-5 ${isActive ? 'border-amber-400/30' : ''}`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Current Plan</p>
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-2xl font-black ${pf.color}`}>{pf.label}</span>
              <PlanBadge plan={data?.plan} />
              {isCancelled && <span className="badge text-red-400 bg-red-400/10">Cancelled</span>}
            </div>
            <div className="flex items-center gap-5 text-sm text-slate-400 flex-wrap">
              <span>👥 {typeof pf.employees === 'number' ? `${pf.employees} employees` : 'Unlimited employees'}</span>
              <span>🏢 {typeof pf.clients === 'number' ? `${pf.clients} clients` : 'Unlimited clients'}</span>
            </div>
          </div>

          <div className="text-right">
            {data?.plan !== 'free' && (
              <>
                {data?.planCycle && (
                  <p className="text-sm text-slate-400 mb-1">
                    {data.planCycle.charAt(0).toUpperCase() + data.planCycle.slice(1)} billing
                  </p>
                )}
                {data?.planRenewsAt && !isCancelled && (
                  <p className="text-sm text-slate-300">
                    Renews <span className="text-amber-400 font-semibold">{fmtDate(data.planRenewsAt)}</span>
                  </p>
                )}
                {isCancelled && data?.planExpiresAt && (
                  <p className="text-sm text-red-400">
                    Access until {fmtDate(data.planExpiresAt)}
                    {daysLeft !== null && <span className="ml-1">({daysLeft} days)</span>}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Expiry warning */}
        {daysLeft !== null && daysLeft <= 7 && isActive && (
          <div className="mt-4 p-3 bg-amber-400/5 border border-amber-400/20 rounded-lg flex items-center gap-3">
            <span className="text-amber-400">⚠</span>
            <p className="text-sm text-amber-300">
              Your plan expires in <strong>{daysLeft} days</strong>.{' '}
              <Link to="/pricing" className="underline hover:text-amber-200">Renew now</Link>
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 mt-5 flex-wrap">
          <Link to="/pricing" className="btn-primary text-sm py-2">
            {data?.plan === 'free' ? 'Upgrade Plan →' : 'Change Plan'}
          </Link>
          {isActive && !isCancelled && (
            <button className="btn-danger text-sm py-2" onClick={() => setConfirm(true)}>
              Cancel Subscription
            </button>
          )}
        </div>
      </div>

      {/* Usage meters */}
      {data?.limits && (
        <div className="card mb-5">
          <p className="text-sm font-semibold text-slate-300 mb-4">Plan Usage</p>
          {[
            { label: 'Employees', used: data.usage?.employees || 0, max: data.limits.employees },
            { label: 'Clients',   used: data.usage?.clients   || 0, max: data.limits.clients   },
          ].map(({ label, used, max }) => {
            const unlimited = max >= 999999;
            const pct = unlimited ? 0 : Math.round((used / max) * 100);
            return (
              <div key={label} className="mb-4">
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>{label}</span>
                  <span>{used}{unlimited ? ' (unlimited)' : `/${max}`}</span>
                </div>
                {!unlimited && (
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 90 ? '#f87171' : pct >= 70 ? '#f59e0b' : '#34d399' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Invoice history */}
      <div className="card">
        <p className="text-sm font-semibold text-slate-300 mb-4">Invoice History</p>
        {data?.invoices?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead><tr>
                <th className="th">Invoice #</th>
                <th className="th">Plan</th>
                <th className="th">Amount</th>
                <th className="th">Date</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr></thead>
              <tbody>
                {data.invoices.map(inv => (
                  <tr key={inv._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="td font-mono text-amber-400 text-xs">{inv.invoiceNumber}</td>
                    <td className="td text-slate-300 capitalize">{inv.plan} ({inv.cycle})</td>
                    <td className="td text-slate-200 font-semibold">{fmt(inv.total)}</td>
                    <td className="td text-slate-500 text-xs">{fmtDate(inv.paidAt)}</td>
                    <td className="td">
                      <span className="badge text-emerald-400 bg-emerald-400/10">Paid</span>
                    </td>
                    <td className="td">
                      <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => downloadInvoice(inv)}>
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-sm text-center py-8">
            No invoices yet.{' '}
            {data?.plan === 'free' && <Link to="/pricing" className="text-amber-400 hover:text-amber-300">Upgrade to generate your first invoice →</Link>}
          </p>
        )}
      </div>

      {confirm && (
        <ConfirmModal
          title="Cancel Subscription?"
          message={`You will retain ${data?.plan} access until ${fmtDate(data?.planExpiresAt)}. After that, your firm will revert to the Free plan (2 employees, 20 clients).`}
          onConfirm={handleCancel}
          onCancel={() => setConfirm(false)}
          danger
        />
      )}
    </>
  );
}
