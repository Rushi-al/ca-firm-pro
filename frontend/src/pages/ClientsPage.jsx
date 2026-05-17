import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Modal, ConfirmModal, Field, EmptyState, SkeletonRow } from '../components/index.jsx';
import { rules, validate } from '../services/validation';

const PlusIcon  = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const EditIcon  = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>;
const TrashIcon = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;

const SCHEMA = {
  name:      [rules.required, rules.minLength(2)],
  contact:   [rules.required, rules.phone],
  gstRegistrationType: [rules.required],
  gstNumber: [rules.gst],
  isTdsRequired: [],
  email:     [rules.email],
  pan:       [rules.pan],
  aadhar:    [rules.aadhar],
  dob:       [],
};
const EMPTY = { name:'', contact:'', gstRegistrationType:'Registered', gstNumber:'', isTdsRequired: false, email:'', pan:'', aadhar:'', dob:'', notes:'' };

export default function ClientsPage() {
  const { toast }  = useToast();
  const { socket } = useAuth();
  const [clients,  setClients] = useState([]);
  const [total,    setTotal]   = useState(0);
  const [page,     setPage]    = useState(1);
  const [search,   setSearch]  = useState('');
  const [loading,  setLoading] = useState(true);
  const [modal,    setModal]   = useState(false);
  const [editing,  setEditing] = useState(null);
  const [form,     setForm]    = useState(EMPTY);
  const [touched,  setTouched] = useState({});
  const [saving,   setSaving]  = useState(false);
  const [confirm,  setConfirm] = useState(null);
  const LIMIT = 15;

  useEffect(() => { document.title = 'Clients | CA Firm Pro'; }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/clients?search=${search}&page=${page}&limit=${LIMIT}`);
      setClients(res.data.data.clients);
      setTotal(res.data.data.total);
    } finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (data.type === 'client') load();
    };
    socket.on('firm_data_updated', handler);
    return () => socket.off('firm_data_updated', handler);
  }, [socket, load]);

  const getErr = k => validate(form[k], ...(SCHEMA[k] || []));
  const touch  = k => setTouched(t => ({ ...t, [k]: true }));
  const setF   = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const cls    = k => `input ${touched[k] ? (getErr(k) ? 'input-error' : 'input-ok') : ''}`;

  const openAdd  = () => { setForm(EMPTY); setEditing(null); setTouched({}); setModal(true); };
  const openEdit = c => { setForm({ name:c.name, contact:c.contact, gstRegistrationType:c.gstRegistrationType||'Registered', gstNumber:c.gstNumber||'', isTdsRequired:c.isTdsRequired||false, email:c.email||'', pan:c.pan||'', aadhar:c.aadhar||'', dob:c.dob ? c.dob.split('T')[0] : '', notes:c.notes||'' }); setEditing(c); setTouched({}); setModal(true); };

  const save = async () => {
    const allTouched = Object.fromEntries(Object.keys(SCHEMA).map(k => [k, true]));
    setTouched(allTouched);
    if (Object.keys(SCHEMA).some(k => getErr(k))) return;
    const payload = { ...form };
    if (payload.gstRegistrationType === 'Unregistered') payload.gstNumber = '';
    
    setSaving(true);
    try {
      if (editing) { await api.put(`/clients/${editing._id}`, payload); toast('Client updated.', 'success'); }
      else         { await api.post('/clients', payload);                toast('Client added.', 'success');   }
      setModal(false); load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save.', 'error');
    } finally { setSaving(false); }
  };

  const del = async (c) => {
    try {
      await api.delete(`/clients/${c._id}`);
      toast(`"${c.name}" deleted.`, 'success');
      setConfirm(null); load();
    } catch (err) {
      toast(err.response?.data?.message || 'Cannot delete client.', 'error');
      setConfirm(null);
    }
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div><h1 className="text-xl font-bold text-slate-100 mb-0.5">Clients</h1><p className="text-sm text-slate-500">{total} total</p></div>
        <button className="btn-primary" onClick={openAdd}><PlusIcon /> Add Client</button>
      </div>

      <input className="input mb-5 bg-[#0f172a] border-slate-800" placeholder="Search clients by name…"
        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />

      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead><tr>
            <th className="th">Client Name</th><th className="th">Contact</th>
            <th className="th">GST Number</th><th className="th">Email</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {loading ? [1,2,3].map(i => <SkeletonRow key={i} />) : clients.map(c => (
              <tr key={c._id} className="hover:bg-slate-800/30 transition-colors">
                <td className="td font-semibold text-slate-100">{c.name}</td>
                <td className="td text-slate-400 font-mono text-xs">{c.contact}</td>
                <td className="td text-slate-400 font-mono text-xs">{c.gstNumber || <span className="text-slate-700">—</span>}</td>
                <td className="td text-slate-500 text-xs">{c.email || <span className="text-slate-700">—</span>}</td>
                <td className="td"><div className="flex gap-2">
                  <button className="btn-ghost" onClick={() => openEdit(c)}><EditIcon /></button>
                  <button className="btn-ghost hover:text-red-400 hover:bg-red-400/10" onClick={() => setConfirm(c)}><TrashIcon /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && clients.length === 0 && <EmptyState title="No clients found" sub="Add your first client or adjust your search." />}
      </div>

      {pages > 1 && (
        <div className="flex gap-2">
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} onClick={() => setPage(i+1)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${page===i+1 ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              {i+1}
            </button>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={editing ? 'Edit Client' : 'Add Client'} onClose={() => setModal(false)}>
          <Field label="Client Name" error={getErr('name')} touched={touched.name} required>
            <input className={cls('name')} placeholder="Company name" value={form.name} onChange={setF('name')} onBlur={() => touch('name')} />
          </Field>
          <Field label="Phone Contact" error={getErr('contact')} touched={touched.contact} required>
            <input className={cls('contact')} placeholder="10-digit number" value={form.contact} onChange={setF('contact')} onBlur={() => touch('contact')} />
          </Field>
          <Field label="Email" error={getErr('email')} touched={touched.email}>
            <input className={cls('email')} type="email" placeholder="client@company.com" value={form.email} onChange={setF('email')} onBlur={() => touch('email')} />
          </Field>
          <Field label="GST Registration Type" error={getErr('gstRegistrationType')} touched={touched.gstRegistrationType} required>
            <select className={cls('gstRegistrationType')} value={form.gstRegistrationType} onChange={setF('gstRegistrationType')} onBlur={() => touch('gstRegistrationType')}>
              <option value="Registered">Registered</option>
              <option value="Unregistered">Unregistered</option>
            </select>
          </Field>
          {form.gstRegistrationType === 'Registered' && (
            <Field label="GST Number" error={getErr('gstNumber')} touched={touched.gstNumber}>
              <input className={cls('gstNumber')} placeholder="24AABCT1234D1Z5" value={form.gstNumber} onChange={setF('gstNumber')} onBlur={() => touch('gstNumber')} />
            </Field>
          )}
          <Field label="TDS Details" error={getErr('isTdsRequired')} touched={touched.isTdsRequired}>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500"
                checked={form.isTdsRequired} onChange={e => setForm(f => ({ ...f, isTdsRequired: e.target.checked }))} />
              <span className="text-sm text-slate-300">TDS is applicable for this client</span>
            </label>
          </Field>
          <Field label="PAN Number" error={getErr('pan')} touched={touched.pan}>
            <input className={cls('pan')} placeholder="ABCDE1234F" value={form.pan} onChange={setF('pan')} onBlur={() => touch('pan')} />
          </Field>
          <Field label="Aadhar Number" error={getErr('aadhar')} touched={touched.aadhar}>
            <input className={cls('aadhar')} placeholder="123456789012" value={form.aadhar} onChange={setF('aadhar')} onBlur={() => touch('aadhar')} />
          </Field>
          <Field label="Date of Birth" error={getErr('dob')} touched={touched.dob}>
            <input type="date" className={cls('dob')} value={form.dob} onChange={setF('dob')} onBlur={() => touch('dob')} />
          </Field>
          <Field label="Notes">
            <textarea className="input" rows={2} placeholder="Optional notes" value={form.notes} onChange={setF('notes')} />
          </Field>
          <div className="flex gap-3 mt-1">
            <button className="btn-primary flex-1 justify-center" onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Client'}</button>
            <button className="btn-outline flex-1 justify-center" onClick={() => setModal(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          title={`Delete "${confirm.name}"?`}
          message="This will permanently delete the client. Clients with active tasks cannot be deleted."
          onConfirm={() => del(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
