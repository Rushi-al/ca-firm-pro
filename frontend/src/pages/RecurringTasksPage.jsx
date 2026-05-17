import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { Modal, ConfirmModal, EmptyState } from '../components/index.jsx';

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

const FREQ_COLORS = {
  weekly:       'text-blue-400   bg-blue-400/10',
  monthly:      'text-amber-400  bg-amber-400/10',
  quarterly:    'text-purple-400 bg-purple-400/10',
  'half-yearly':'text-pink-400   bg-pink-400/10',
  yearly:       'text-emerald-400 bg-emerald-400/10',
};

const TEMPLATE_EXAMPLES = [
  'GST Return Filing — {{month}} {{year}}',
  'TDS Return — {{quarter}} {{year}}',
  'Payroll Processing — {{month}} {{year}}',
  'Annual Audit — {{fy}}',
  'Advance Tax — {{quarter}} {{year}}',
  'ROC Annual Filing — {{year}}',
];

export default function RecurringTasksPage() {
  const { toast }  = useToast();
  const [templates, setTemplates] = useState([]);
  const [clients,   setClients]   = useState([]);
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [confirm,   setConfirm]   = useState(null);
  const [form,      setForm]      = useState({
    titleTemplate: '', clientId: '', assignedTo: '',
    frequency: 'monthly', priority: 'Medium',
    deadlineDayOfMonth: 20, createDaysBefore: 15, notes: '',
  });

  useEffect(() => { document.title = 'Recurring Tasks | CA Firm Pro'; }, []);

  const load = useCallback(async () => {
    try {
      const [t, c, u] = await Promise.all([
        api.get('/recurring'),
        api.get('/clients?limit=200'),
        api.get('/users'),
      ]);
      setTemplates(t.data.data);
      setClients(c.data.data.clients);
      setUsers(u.data.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({ titleTemplate:'', clientId:'', assignedTo:'', frequency:'monthly', priority:'Medium', deadlineDayOfMonth:20, createDaysBefore:15, notes:'' });
    setModal(true);
  };

  const save = async () => {
    if (!form.titleTemplate || !form.clientId || !form.assignedTo) {
      return toast('Title, client, and assigned employee are required.', 'warning');
    }
    try {
      await api.post('/recurring', form);
      toast('Recurring task template created.', 'success');
      setModal(false);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed.', 'error');
    }
  };

  const toggle = async (t) => {
    try {
      await api.put(`/recurring/${t._id}/toggle`);
      toast(`Template ${t.isActive ? 'paused' : 'activated'}.`, 'info');
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed.', 'error');
    }
  };

  const remove = async (t) => {
    try {
      await api.delete(`/recurring/${t._id}`);
      toast('Template deleted.', 'success');
      setConfirm(null);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed.', 'error');
    }
  };

  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 mb-0.5">Recurring Tasks</h1>
          <p className="text-sm text-slate-500">Templates that auto-generate tasks on a schedule</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ New Template</button>
      </div>

      {/* Info card */}
      <div className="mb-5 p-4 bg-slate-800/40 border border-slate-700 rounded-xl">
        <p className="text-sm font-semibold text-slate-300 mb-1">How it works</p>
        <p className="text-sm text-slate-500">
          Create a template with a title like <code className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded text-xs">GST Return Filing — &#123;&#123;month&#125;&#125; &#123;&#123;year&#125;&#125;</code>.
          The system auto-generates a new task at the set frequency, replacing placeholders with actual dates. Tasks are created <strong className="text-slate-300">N days before</strong> the deadline.
        </p>
      </div>

      {/* Template list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : templates.length === 0 ? (
        <EmptyState
          title="No recurring templates"
          sub="Create your first template to automate task generation."
          action={<button className="btn-primary" onClick={openAdd}>+ New Template</button>}
        />
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t._id} className={`card flex items-start justify-between gap-4 flex-wrap ${!t.isActive ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-slate-100">{t.titleTemplate}</span>
                  <span className={`badge capitalize text-xs ${FREQ_COLORS[t.frequency]}`}>{t.frequency}</span>
                  {!t.isActive && <span className="badge text-slate-500 bg-slate-800">Paused</span>}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                  <span>📁 {t.clientId?.name}</span>
                  <span>👤 {t.assignedTo?.name?.split(' ')[0]}</span>
                  <span>🎯 {t.priority} priority</span>
                  <span>📅 Deadline day {t.deadlineDayOfMonth}</span>
                  <span>⏰ Create {t.createDaysBefore} days before</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-600 mt-1.5 flex-wrap">
                  <span>Generated: {t.generatedCount} tasks</span>
                  <span>Last: {fmtDate(t.lastGeneratedAt)}</span>
                  <span>Next: {fmtDate(t.nextGenerateAt)}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => toggle(t)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                    t.isActive
                      ? 'border-amber-400/30 text-amber-400 hover:bg-amber-400/10'
                      : 'border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10'
                  }`}>
                  {t.isActive ? 'Pause' : 'Activate'}
                </button>
                <button
                  className="btn-ghost hover:text-red-400 hover:bg-red-400/10 text-xs px-2.5"
                  onClick={() => setConfirm(t)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {modal && (
        <Modal title="New Recurring Template" onClose={() => setModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Task Title Template *</label>
              <input className="input" placeholder="e.g. GST Return Filing — {{month}} {{year}}"
                value={form.titleTemplate} onChange={setF('titleTemplate')} />
              <p className="text-xs text-slate-600 mt-1">Use: &#123;&#123;month&#125;&#125;, &#123;&#123;quarter&#125;&#125;, &#123;&#123;year&#125;&#125;, &#123;&#123;fy&#125;&#125;</p>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {TEMPLATE_EXAMPLES.map(ex => (
                <button key={ex} onClick={() => setForm(f => ({ ...f, titleTemplate: ex }))}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg transition-colors">
                  {ex}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Client *</label>
                <select className="input" value={form.clientId} onChange={setF('clientId')}>
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Assign To *</label>
                <select className="input" value={form.assignedTo} onChange={setF('assignedTo')}>
                  <option value="">Select employee</option>
                  {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Frequency</label>
                <select className="input" value={form.frequency} onChange={setF('frequency')}>
                  {['weekly','monthly','quarterly','half-yearly','yearly'].map(f => (
                    <option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
                <select className="input" value={form.priority} onChange={setF('priority')}>
                  {['High','Medium','Low'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Deadline Day of Month</label>
                <input className="input" type="number" min="1" max="28" value={form.deadlineDayOfMonth} onChange={setF('deadlineDayOfMonth')} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Create N Days Before</label>
                <input className="input" type="number" min="1" max="60" value={form.createDaysBefore} onChange={setF('createDaysBefore')} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={setF('notes')} />
            </div>
            <div className="flex gap-3">
              <button className="btn-primary flex-1 justify-center" onClick={save}>Create Template</button>
              <button className="btn-outline flex-1 justify-center" onClick={() => setModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          title={`Delete template?`}
          message={`"${confirm.titleTemplate}" will be deleted. Previously generated tasks will remain.`}
          onConfirm={() => remove(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
