import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { Modal, EmptyState, Field } from '../components/index.jsx';
import { rules, validate } from '../services/validation';

const SCHEMA = {
  name:     [rules.required, rules.minLength(2)],
  email:    [rules.required, rules.email],
  password: [rules.required, rules.password],
};

const EMPTY = { clientId:'', name:'', email:'', password:'', canUploadDocuments: false };

export default function ClientPortalPage() {
  const { toast }   = useToast();
  const [clients,   setClients]   = useState([]);
  const [portals,   setPortals]   = useState([]); // local state only
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState(EMPTY);
  const [touched,   setTouched]   = useState({});
  const [saving,    setSaving]    = useState(false);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => { document.title = 'Client Portal | CA Firm Pro'; }, []);

  useEffect(() => {
    api.get('/clients?limit=200')
      .then(r => setClients(r.data.data.clients))
      .finally(() => setLoading(false));
  }, []);

  const getErr = k => validate(form[k], ...(SCHEMA[k] || []));
  const touch  = k => setTouched(t => ({ ...t, [k]: true }));
  const setF   = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const cls    = k => `input ${touched[k] ? (getErr(k) ? 'input-error' : 'input-ok') : ''}`;

  const openAdd = () => { setForm(EMPTY); setTouched({}); setModal(true); };

  const save = async () => {
    const allTouched = Object.fromEntries(Object.keys(SCHEMA).map(k => [k, true]));
    setTouched(allTouched);
    if (Object.keys(SCHEMA).some(k => getErr(k))) return;
    if (!form.clientId) return toast('Please select a client.', 'warning');

    setSaving(true);
    try {
      const res = await api.post('/portal/create-access', form);
      toast(res.data.message, 'success');
      const client = clients.find(c => c._id === form.clientId);
      setPortals(p => [...p, { ...form, clientName: client?.name, createdAt: new Date() }]);
      setModal(false);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to create access.', 'error');
    } finally { setSaving(false); }
  };

  const portalUrl = `${window.location.origin}/client-portal`;

  return (
    <>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 mb-0.5">Client Portal</h1>
          <p className="text-sm text-slate-500">Give clients read-only access to their tasks and documents</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Create Portal Access</button>
      </div>

      {/* Portal URL */}
      <div className="card mb-5">
        <p className="text-sm font-semibold text-slate-300 mb-2">Client Login URL</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-xs text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded-lg px-4 py-3 font-mono overflow-x-auto">
            {portalUrl}
          </code>
          <button
            className="btn-outline text-xs py-2.5 px-4 flex-shrink-0"
            onClick={() => { navigator.clipboard.writeText(portalUrl); toast('URL copied!', 'success'); }}>
            Copy
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Share this URL with your clients along with their login credentials. Each client sees only their own data.
        </p>
      </div>

      {/* What clients can see */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { icon: '📋', title: 'Task Status',     desc: 'View real-time status of all their tasks — In Progress, Completed, Overdue.' },
          { icon: '🧾', title: 'GST Filings',     desc: 'Track their GST return filing history and upcoming deadlines.' },
          { icon: '📁', title: 'Documents',       desc: 'Download documents uploaded by your team — ITR, audit reports, etc.' },
        ].map(f => (
          <div key={f.title} className="card text-center">
            <div className="text-3xl mb-2">{f.icon}</div>
            <p className="text-sm font-semibold text-slate-200 mb-1">{f.title}</p>
            <p className="text-xs text-slate-500">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Active portals */}
      <div className="card">
        <p className="text-sm font-semibold text-slate-300 mb-4">Active Portal Accounts</p>
        {loading ? (
          <div className="skeleton h-20 rounded-xl" />
        ) : portals.length === 0 ? (
          <EmptyState
            title="No portal accounts yet"
            sub="Create portal access for a client to let them log in and track their work."
            action={<button className="btn-primary" onClick={openAdd}>+ Create Portal Access</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>
                <th className="th">Client</th>
                <th className="th">Portal Email</th>
                <th className="th">Can Upload</th>
                <th className="th">Created</th>
              </tr></thead>
              <tbody>
                {portals.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="td font-semibold text-slate-100">{p.clientName}</td>
                    <td className="td text-slate-400 font-mono text-xs">{p.email}</td>
                    <td className="td">
                      <span className={`badge text-xs ${p.canUploadDocuments ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-500 bg-slate-800'}`}>
                        {p.canUploadDocuments ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="td text-xs text-slate-500">
                      {new Date(p.createdAt).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create access modal */}
      {modal && (
        <Modal title="Create Portal Access" onClose={() => setModal(false)}>
          <div className="space-y-1">
            <div className="mb-3">
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Client *</label>
              <select className="input" value={form.clientId} onChange={setF('clientId')}>
                <option value="">Select client</option>
                {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>

            <Field label="Contact Person Name" error={getErr('name')} touched={touched.name} required>
              <input className={cls('name')} placeholder="e.g. Ramesh Gupta"
                value={form.name} onChange={setF('name')} onBlur={() => touch('name')} />
            </Field>

            <Field label="Login Email" error={getErr('email')} touched={touched.email} required>
              <input className={cls('email')} type="email" placeholder="client@company.com"
                value={form.email} onChange={setF('email')} onBlur={() => touch('email')} />
            </Field>

            <Field label="Password" error={getErr('password')} touched={touched.password} required>
              <input className={cls('password')} type="password" placeholder="Min 8 characters"
                value={form.password} onChange={setF('password')} onBlur={() => touch('password')} />
            </Field>

            <div className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                id="canUpload"
                checked={form.canUploadDocuments}
                onChange={e => setForm(f => ({ ...f, canUploadDocuments: e.target.checked }))}
                className="w-4 h-4 accent-amber-400"
              />
              <label htmlFor="canUpload" className="text-sm text-slate-300 cursor-pointer">
                Allow client to upload documents
              </label>
            </div>

            <div className="p-3 bg-amber-400/5 border border-amber-400/20 rounded-lg mt-2">
              <p className="text-xs text-amber-300">
                ⚠️ Share these credentials with your client securely.
                They will be able to log in at <strong>{portalUrl}</strong>
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-primary flex-1 justify-center" onClick={save} disabled={saving}>
                {saving ? 'Creating…' : 'Create Access'}
              </button>
              <button className="btn-outline flex-1 justify-center" onClick={() => setModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
