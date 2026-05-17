// ── TasksPage.jsx ──────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { Modal, ConfirmModal, StatusBadge, PriBadge, Field, EmptyState, SkeletonRow, LiveDot } from '../components/index.jsx';
import { rules, validate } from '../services/validation';

const PlusIcon  = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const EditIcon  = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>;
const TrashIcon = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;

const fmtDate   = d => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
const isOverdue = t => t.status !== 'Completed' && new Date(t.deadline) < new Date(new Date().toDateString());
const statusFromProgress = p => p===0 ? 'Not Started' : p===100 ? 'Completed' : 'In Progress';
const EMPTY = { title:'', clientId:'', assignedTo:'', priority:'Medium', deadline:'', progress:0, notes:'' };
const POLL_MS = 20000;

export function TasksPage() {
  const { user, socket } = useAuth();
  const { toast }  = useToast();
  const isAdmin    = ['Owner','Admin'].includes(user?.role);
  const [tasks,    setTasks]    = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [clients,  setClients]  = useState([]);
  const [emps,     setEmps]     = useState([]);
  const [filt,     setFilt]     = useState({ status:'', priority:'', emp:'' });
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [lastUpd,  setLastUpd]  = useState(null);
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [touched,  setTouched]  = useState({});
  const [saving,   setSaving]   = useState(false);
  const [confirm,  setConfirm]  = useState(null);
  const prevRef = useRef(null);

  useEffect(() => { document.title = 'Tasks | CA Firm Pro'; }, []);

  const load = useCallback(async (isPolling = false) => {
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (filt.status && filt.status !== 'Overdue') params.set('status', filt.status);
      if (filt.priority) params.set('priority', filt.priority);
      if (filt.emp && isAdmin) params.set('assignedTo', filt.emp);
      const res = await api.get(`/tasks?${params}`);
      let t = res.data.data.tasks;
      if (filt.status === 'Overdue') t = t.filter(isOverdue);
      const sig = JSON.stringify(t.map(x => ({ id: x._id, p: x.progress, s: x.status })));
      if (isPolling && prevRef.current && prevRef.current !== sig) toast('Tasks updated.', 'info');
      prevRef.current = sig;
      setAllTasks(t);
      setLastUpd(Date.now());
    } finally { setLoading(false); }
  }, [filt, isAdmin, toast]);

  useEffect(() => { load(false); const id = setInterval(() => load(true), POLL_MS); return () => clearInterval(id); }, [load]);
  
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (data.type === 'task') load(true);
    };
    socket.on('firm_data_updated', handler);
    return () => socket.off('firm_data_updated', handler);
  }, [socket, load]);

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/clients?limit=200').then(r => setClients(r.data.data.clients));
    api.get('/users').then(r => setEmps(r.data.data));
  }, [isAdmin]);

  // Client-side search filter
  useEffect(() => {
    if (!search.trim()) { setTasks(allTasks); return; }
    const q = search.toLowerCase();
    setTasks(allTasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.clientId?.name?.toLowerCase().includes(q) ||
      t.assignedTo?.name?.toLowerCase().includes(q)
    ));
  }, [search, allTasks]);

  const SCHEMA = {
    title:    [rules.required, rules.minLength(2)],
    deadline: [rules.required],
    ...(isAdmin ? { clientId: [rules.selectRequired], assignedTo: [rules.selectRequired] } : {}),
  };
  const getErr = k => validate(form[k], ...(SCHEMA[k] || []));
  const touch  = k => setTouched(t => ({ ...t, [k]: true }));
  const setF   = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const cls    = k => `input ${touched[k] ? (getErr(k) ? 'input-error' : 'input-ok') : ''}`;

  const openAdd  = () => { setForm(EMPTY); setEditing(null); setTouched({}); setModal(true); };
  const openEdit = t => { setForm({ title:t.title, clientId:t.clientId?._id||t.clientId, assignedTo:t.assignedTo?._id||t.assignedTo, priority:t.priority, deadline:t.deadline?.split('T')[0]||'', progress:t.progress, notes:t.notes||'' }); setEditing(t); setTouched({}); setModal(true); };

  const save = async () => {
    const allT = Object.fromEntries(Object.keys(SCHEMA).map(k => [k, true]));
    setTouched(allT);
    if (Object.keys(SCHEMA).some(k => getErr(k))) return;
    setSaving(true);
    try {
      if (editing) { await api.put(`/tasks/${editing._id}`, { ...form, progress: Number(form.progress) }); toast('Task updated.', 'success'); }
      else         { await api.post('/tasks', { ...form, progress: Number(form.progress) });               toast('Task created.', 'success'); }
      setModal(false); load(false);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save.', 'error');
    } finally { setSaving(false); }
  };

  const del = async (t) => {
    try { await api.delete(`/tasks/${t._id}`); toast('Task deleted.', 'success'); setConfirm(null); load(false); }
    catch (err) { toast(err.response?.data?.message || 'Cannot delete.', 'error'); setConfirm(null); }
  };

  return (
    <>
      <div className="flex justify-between items-start gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-100 mb-0.5">Tasks</h1>
          <p className="text-sm text-slate-500">Showing {tasks.length} of {allTasks.length}</p>
        </div>
        <div className="flex items-center gap-3">
          <LiveDot lastUpdated={lastUpd} />
          <button className="btn-primary" onClick={openAdd}><PlusIcon /> Add Task</button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex gap-2.5 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <input className="input bg-[#0f172a] border-slate-800 pr-8" placeholder="Search tasks, clients, employees…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              onClick={() => setSearch('')}>×</button>
          )}
        </div>
        {[['status', ['Not Started','In Progress','Completed','Overdue']], ['priority', ['High','Medium','Low']]].map(([key, opts]) => (
          <select key={key} className="input w-auto bg-[#0f172a] border-slate-800 text-xs py-2"
            value={filt[key]} onChange={e => setFilt(f => ({ ...f, [key]: e.target.value }))}>
            <option value="">{key.charAt(0).toUpperCase()+key.slice(1)}: All</option>
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        {isAdmin && (
          <select className="input w-auto bg-[#0f172a] border-slate-800 text-xs py-2"
            value={filt.emp} onChange={e => setFilt(f => ({ ...f, emp: e.target.value }))}>
            <option value="">Employee: All</option>
            {emps.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
        )}
        {(filt.status||filt.priority||filt.emp||search) && (
          <button className="btn-outline text-xs py-2 px-3" onClick={() => { setFilt({status:'',priority:'',emp:''}); setSearch(''); }}>Clear</button>
        )}
      </div>

      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden overflow-x-auto mb-4">
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr>
            <th className="th">Task</th><th className="th">Client</th>
            {isAdmin && <th className="th">Assigned</th>}
            <th className="th">Priority</th><th className="th">Status</th>
            <th className="th">Deadline</th><th className="th">Progress</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {loading ? [1,2,3,4].map(i => <SkeletonRow key={i} />) : tasks.map(t => {
              const od = isOverdue(t);
              return (
                <tr key={t._id} className={`hover:bg-slate-800/30 transition-colors ${od ? 'bg-red-500/[0.03]' : ''}`}>
                  <td className="td"><p className="font-semibold text-slate-100">{t.title}</p>{t.notes && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[160px]">{t.notes}</p>}</td>
                  <td className="td text-slate-400 text-xs max-w-[120px] truncate">{t.clientId?.name}</td>
                  {isAdmin && <td className="td text-slate-400 text-xs">{t.assignedTo?.name?.split(' ')[0]}</td>}
                  <td className="td"><PriBadge priority={t.priority} /></td>
                  <td className="td"><StatusBadge task={t} /></td>
                  <td className="td text-xs whitespace-nowrap" style={{ color: od ? '#f87171' : '#64748b' }}>{fmtDate(t.deadline)}</td>
                  <td className="td"><div className="flex items-center gap-2">
                    <div className="w-14 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width:`${t.progress}%`, background: od ? '#ef4444' : '#f59e0b' }} />
                    </div>
                    <span className="text-xs text-slate-500">{t.progress}%</span>
                  </div></td>
                  <td className="td"><div className="flex gap-1.5">
                    <button className="btn-ghost" onClick={() => openEdit(t)}><EditIcon /></button>
                    {isAdmin && <button className="btn-ghost hover:text-red-400 hover:bg-red-400/10" onClick={() => setConfirm(t)}><TrashIcon /></button>}
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && tasks.length === 0 && <EmptyState title="No tasks found" sub="Try adjusting filters or create a new task." />}
      </div>

      {modal && (
        <Modal title={editing ? 'Edit Task' : 'Create Task'} onClose={() => setModal(false)}>
          <Field label="Task Title" error={getErr('title')} touched={touched.title} required>
            <input className={cls('title')} placeholder="e.g. GST Return Filing Q2" value={form.title} onChange={setF('title')} onBlur={() => touch('title')} />
          </Field>
          {isAdmin && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client" error={getErr('clientId')} touched={touched.clientId} required>
                <select className={cls('clientId')} value={form.clientId} onChange={setF('clientId')} onBlur={() => touch('clientId')}>
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Assign To" error={getErr('assignedTo')} touched={touched.assignedTo} required>
                <select className={cls('assignedTo')} value={form.assignedTo} onChange={setF('assignedTo')} onBlur={() => touch('assignedTo')}>
                  <option value="">Select employee</option>
                  {emps.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                </select>
              </Field>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select className="input" value={form.priority} onChange={setF('priority')}>
                {['High','Medium','Low'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Deadline" error={getErr('deadline')} touched={touched.deadline} required>
              <input className={cls('deadline')} type="date" value={form.deadline} onChange={setF('deadline')} onBlur={() => touch('deadline')} />
            </Field>
          </div>
          <Field label={`Progress: ${form.progress}% → ${statusFromProgress(Number(form.progress))}`}>
            <input type="range" min="0" max="100" step="5" value={form.progress}
              onChange={e => setForm(f => ({ ...f, progress: Number(e.target.value) }))} />
          </Field>
          <Field label="Notes">
            <textarea className="input" rows={2} placeholder="Optional notes" value={form.notes} onChange={setF('notes')} />
          </Field>
          <div className="flex gap-3 mt-2">
            <button className="btn-primary flex-1 justify-center" onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Task'}</button>
            <button className="btn-outline flex-1 justify-center" onClick={() => setModal(false)}>Cancel</button>
          </div>
        </Modal>
      )}
      {confirm && (
        <ConfirmModal title={`Delete "${confirm.title}"?`} message="Only completed tasks can be deleted permanently."
          onConfirm={() => del(confirm)} onCancel={() => setConfirm(null)} />
      )}
    </>
  );
}

export default TasksPage;
