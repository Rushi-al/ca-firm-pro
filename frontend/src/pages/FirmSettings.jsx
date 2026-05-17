import { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Field, PlanBadge } from '../components/index.jsx';
import { rules, validate } from '../services/validation';

export default function FirmSettings() {
  const { toast } = useToast();
  const { firm }  = useAuth();
  const [data,    setData]    = useState(null);
  const [form,    setForm]    = useState({ name:'', phone:'', address:'', gstin:'' });
  const [touched, setTouched] = useState({});
  const [saving,  setSaving]  = useState(false);
  const [pwForm,  setPwForm]  = useState({ currentPassword:'', newPassword:'' });
  const [pwSave,  setPwSave]  = useState(false);

  useEffect(() => { document.title = 'Firm Settings | CA Firm Pro'; }, []);

  useEffect(() => {
    api.get('/firms/me').then(res => {
      const { firm, usage, limits } = res.data.data;
      setData({ firm, usage, limits });
      setForm({ name: firm.name||'', phone: firm.phone||'', address: firm.address||'', gstin: firm.gstin||'' });
    });
  }, []);

  const schema = {
    name:  [rules.required, rules.minLength(2)],
    gstin: [rules.gst],
  };
  const getErr = k => validate(form[k], ...(schema[k] || []));
  const touch  = k => setTouched(t => ({ ...t, [k]: true }));
  const setF   = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const cls    = k => `input ${touched[k] ? (getErr(k) ? 'input-error' : 'input-ok') : ''}`;

  const saveFirm = async () => {
    setTouched({ name: true, gstin: true });
    if (getErr('name') || getErr('gstin')) return;
    setSaving(true);
    try {
      await api.put('/firms/me', form);
      toast('Firm settings saved.', 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save.', 'error');
    } finally { setSaving(false); }
  };

  const savePassword = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword) return toast('Please fill both fields.', 'warning');
    if (pwForm.newPassword.length < 8) return toast('New password must be at least 8 characters.', 'error');
    setPwSave(true);
    try {
      await api.put('/auth/change-password', pwForm);
      toast('Password changed successfully.', 'success');
      setPwForm({ currentPassword:'', newPassword:'' });
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to change password.', 'error');
    } finally { setPwSave(false); }
  };

  if (!data) return <div className="text-slate-500 text-sm">Loading settings…</div>;

  const { usage, limits } = data;
  const usagePct = r => limits[r] >= 999999 ? 100 : Math.round((usage[r] / limits[r]) * 100);

  return (
    <>
      <h1 className="text-xl font-bold text-slate-100 mb-1">Firm Settings</h1>
      <p className="text-sm text-slate-500 mb-7">Manage your firm profile and subscription</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* Firm info */}
        <div className="card">
          <p className="text-sm font-semibold text-slate-300 mb-4">Firm Profile</p>
          <Field label="Firm Name" error={getErr('name')} touched={touched.name} required>
            <input className={cls('name')} value={form.name} onChange={setF('name')} onBlur={() => touch('name')} />
          </Field>
          <Field label="Phone">
            <input className="input" value={form.phone} onChange={setF('phone')} placeholder="10-digit number" />
          </Field>
          <Field label="Address">
            <textarea className="input" rows={2} value={form.address} onChange={setF('address')} placeholder="Firm address" />
          </Field>
          <Field label="GSTIN" error={getErr('gstin')} touched={touched.gstin}>
            <input className={cls('gstin')} value={form.gstin} onChange={setF('gstin')} onBlur={() => touch('gstin')} placeholder="e.g. 24AABCT1234D1Z5" />
          </Field>
          <button className="btn-primary" onClick={saveFirm} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* Plan & usage */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-300">Plan & Usage</p>
            <PlanBadge plan={data.firm.plan} />
          </div>

          {[
            { label: 'Employees', key: 'employees' },
            { label: 'Clients',   key: 'clients'   },
            { label: 'Tasks',     key: 'tasks'      },
          ].map(({ label, key }) => (
            <div key={key} className="mb-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>{label}</span>
                <span>{usage[key]}{limits[key] < 999999 ? `/${limits[key]}` : ' (unlimited)'}</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${Math.min(usagePct(key), 100)}%`, background: usagePct(key) >= 90 ? '#f87171' : '#f59e0b' }} />
              </div>
            </div>
          ))}

          {data.firm.plan === 'free' && (
            <div className="mt-5 p-4 bg-amber-400/5 border border-amber-400/20 rounded-xl">
              <p className="text-sm font-semibold text-amber-300 mb-1">Upgrade to Pro</p>
              <p className="text-xs text-slate-500 mb-3">10 employees, unlimited clients, priority support.</p>
              <button className="btn-primary text-xs py-1.5 px-3">Upgrade — ₹999/month</button>
            </div>
          )}
        </div>
      </div>

      {/* Change password */}
      <div className="card max-w-md">
        <p className="text-sm font-semibold text-slate-300 mb-4">Change Password</p>
        <Field label="Current Password">
          <input className="input" type="password" placeholder="Enter current password"
            value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} />
        </Field>
        <Field label="New Password">
          <input className="input" type="password" placeholder="Min 8 characters"
            value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} />
        </Field>
        <button className="btn-primary" onClick={savePassword} disabled={pwSave}>
          {pwSave ? 'Saving…' : 'Change Password'}
        </button>
      </div>
    </>
  );
}
