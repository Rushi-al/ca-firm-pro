import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Modal, ConfirmModal, RoleBadge, Field, EmptyState, SkeletonRow } from '../components/index.jsx';
import { rules, validate, validateForm, isValid } from '../services/validation';

const PlusIcon  = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const TrashIcon = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;

const SCHEMA = {
  name:     [rules.required, rules.minLength(2)],
  email:    [rules.required, rules.email],
  password: [rules.required, rules.password],
};

const EMPTY = { name: '', email: '', password: '', role: 'Employee' };

export default function EmployeesPage() {
  const { toast }  = useToast();
  const { firm }   = useAuth();
  const [users,    setUsers]   = useState([]);
  const [tasks,    setTasks]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [modal,    setModal]   = useState(false);
  const [form,     setForm]    = useState(EMPTY);
  const [touched,  setTouched] = useState({});
  const [saving,   setSaving]  = useState(false);
  const [confirm,  setConfirm] = useState(null); // { user }

  useEffect(() => { document.title = 'Employees | CA Firm Pro'; }, []);

  const load = useCallback(async () => {
    try {
      const [u, t] = await Promise.all([api.get('/users'), api.get('/tasks?limit=200')]);
      setUsers(u.data.data);
      setTasks(t.data.data.tasks);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getErr = k => validate(form[k], ...(SCHEMA[k] || []));
  const touch  = k => setTouched(t => ({ ...t, [k]: true }));
  const setF   = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const cls    = k => `input ${touched[k] ? (getErr(k) ? 'input-error' : 'input-ok') : ''}`;

  const openAdd = () => { setForm(EMPTY); setTouched({}); setModal(true); };

  const save = async () => {
    const allTouched = Object.fromEntries(Object.keys(SCHEMA).map(k => [k, true]));
    setTouched(allTouched);
    if (Object.keys(SCHEMA).some(k => getErr(k))) return;
    setSaving(true);
    try {
      await api.post('/users', form);
      toast('Employee added successfully.', 'success');
      setModal(false);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to add employee.', 'error');
    } finally { setSaving(false); }
  };

  const del = async (u) => {
    try {
      await api.delete(`/users/${u._id}`);
      toast(`${u.name} removed.`, 'success');
      setConfirm(null);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Cannot delete employee.', 'error');
      setConfirm(null);
    }
  };

  const taskCount    = uid => tasks.filter(t => t.assignedTo?._id === uid || t.assignedTo === uid).length;
  const activeCount  = uid => tasks.filter(t => (t.assignedTo?._id === uid || t.assignedTo === uid) && t.status !== 'Completed').length;
  const limits       = firm ? { free: 2, pro: 10, enterprise: 999 }[firm.plan] || 2 : 2;
  const empCount     = users.length;

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100 mb-0.5">Employees</h1>
          <p className="text-sm text-slate-500">{empCount}/{limits} on {firm?.plan} plan</p>
        </div>
        <button className="btn-primary" onClick={openAdd} disabled={empCount >= limits}>
          <PlusIcon /> Add Employee
        </button>
      </div>

      {/* Plan limit warning */}
      {empCount >= limits && (
        <div className="mb-5 p-4 bg-amber-400/5 border border-amber-400/20 rounded-xl flex items-center gap-3">
          <span className="text-amber-400 text-lg">⚠</span>
          <div>
            <p className="text-sm font-semibold text-amber-300">Employee limit reached</p>
            <p className="text-xs text-slate-500">Your {firm?.plan} plan allows {limits} employees. Upgrade to Pro for up to 10.</p>
          </div>
        </div>
      )}

      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr>
            <th className="th">Name</th><th className="th">Email</th><th className="th">Role</th>
            <th className="th">Total Tasks</th><th className="th">Active Tasks</th>
            <th className="th">Joined</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {loading
              ? [1,2,3].map(i => <SkeletonRow key={i} />)
              : users.map(u => (
                <tr key={u._id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="td font-semibold text-slate-100">{u.name}</td>
                  <td className="td text-slate-400 text-xs">{u.email}</td>
                  <td className="td"><RoleBadge role={u.role} /></td>
                  <td className="td text-slate-400">{taskCount(u._id)}</td>
                  <td className="td">
                    <span className={activeCount(u._id) > 0 ? 'text-amber-400' : 'text-slate-600'}>
                      {activeCount(u._id)}
                    </span>
                  </td>
                  <td className="td text-slate-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                  </td>
                  <td className="td">
                    <button className="btn-ghost hover:text-red-400 hover:bg-red-400/10"
                      onClick={() => setConfirm(u)}><TrashIcon /></button>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
        {!loading && users.length === 0 && (
          <EmptyState title="No employees yet" sub="Add your first employee to get started." action={
            <button className="btn-primary" onClick={openAdd}><PlusIcon /> Add Employee</button>
          } />
        )}
      </div>

      {/* Add modal */}
      {modal && (
        <Modal title="Add Employee" onClose={() => setModal(false)}>
          <Field label="Full Name" error={getErr('name')} touched={touched.name} required>
            <input className={cls('name')} placeholder="e.g. Rajesh Shah"
              value={form.name} onChange={setF('name')} onBlur={() => touch('name')} />
          </Field>
          <Field label="Email Address" error={getErr('email')} touched={touched.email} required>
            <input className={cls('email')} type="email" placeholder="rajesh@yourfirm.com"
              value={form.email} onChange={setF('email')} onBlur={() => touch('email')} />
          </Field>
          <Field label="Password" error={getErr('password')} touched={touched.password} required>
            <input className={cls('password')} type="password" placeholder="Min 8 characters"
              value={form.password} onChange={setF('password')} onBlur={() => touch('password')} />
          </Field>
          <Field label="Role">
            <select className="input" value={form.role} onChange={setF('role')}>
              <option value="Employee">Employee</option>
              <option value="Admin">Admin</option>
            </select>
          </Field>
          <div className="flex gap-3 mt-2">
            <button className="btn-primary flex-1 justify-center" onClick={save} disabled={saving}>
              {saving ? 'Adding…' : 'Add Employee'}
            </button>
            <button className="btn-outline flex-1 justify-center" onClick={() => setModal(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* Confirm delete */}
      {confirm && (
        <ConfirmModal
          title={`Remove ${confirm.name}?`}
          message={`This will permanently remove ${confirm.name} from your firm. Active tasks must be reassigned first.`}
          onConfirm={() => del(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
