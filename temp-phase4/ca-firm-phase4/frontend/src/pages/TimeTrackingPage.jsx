import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Modal, ConfirmModal, EmptyState } from '../components/index.jsx';

const fmtMins = m => {
  const h = Math.floor(m / 60), min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
};
const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
const fmtAmt  = a => a > 0 ? `₹${a.toLocaleString('en-IN')}` : '—';

const EMPTY = {
  taskId:'', date: new Date().toISOString().split('T')[0],
  startTime:'', endTime:'', durationMins:30,
  isBillable:true, hourlyRate:0, description:'',
};

export default function TimeTrackingPage() {
  const { user }  = useAuth();
  const { toast } = useToast();
  const isAdmin   = ['Owner','Admin'].includes(user?.role);
  const timerRef  = useRef(null);

  const [entries,  setEntries]  = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [tasks,    setTasks]    = useState([]);
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [form,     setForm]     = useState(EMPTY);
  const [filt,     setFilt]     = useState({ userId:'', from:'', to:'' });
  const [confirm,  setConfirm]  = useState(null);

  // Live timer
  const [timerOn,    setTimerOn]    = useState(false);
  const [timerSecs,  setTimerSecs]  = useState(0);
  const [timerTaskId,setTimerTaskId]= useState('');

  useEffect(() => { document.title = 'Time Tracking | CA Firm Pro'; }, []);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit:200 });
      if (filt.userId) params.set('userId', filt.userId);
      if (filt.from)   params.set('from',   filt.from);
      if (filt.to)     params.set('to',     filt.to);
      const [e, t, u] = await Promise.all([
        api.get(`/time?${params}`),
        api.get('/tasks?limit=200'),
        isAdmin ? api.get('/users') : Promise.resolve({ data:{ data:[] } }),
      ]);
      setEntries(e.data.data.entries);
      setSummary(e.data.data.summary);
      setTasks(t.data.data.tasks);
      setUsers(u.data.data);
    } finally { setLoading(false); }
  }, [filt, isAdmin]);

  useEffect(() => { load(); }, [load]);

  // Live timer logic
  useEffect(() => {
    if (timerOn) {
      timerRef.current = setInterval(() => setTimerSecs(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerOn]);

  const startTimer = () => {
    if (!timerTaskId) return toast('Select a task to start timer.', 'warning');
    setTimerSecs(0);
    setTimerOn(true);
    toast('Timer started.', 'info');
  };

  const stopTimer = () => {
    setTimerOn(false);
    const mins = Math.max(1, Math.round(timerSecs / 60));
    setForm(f => ({ ...f, taskId: timerTaskId, durationMins: mins }));
    setModal(true);
    setTimerSecs(0);
    toast(`Logged ${fmtMins(mins)} from timer.`, 'info');
  };

  const fmtTimer = s => {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const save = async () => {
    if (!form.taskId || !form.durationMins) return toast('Task and duration are required.', 'warning');
    try {
      await api.post('/time', { ...form, durationMins: Number(form.durationMins), hourlyRate: Number(form.hourlyRate) });
      toast('Time logged.', 'success');
      setModal(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed.', 'error');
    }
  };

  const del = async (e) => {
    try {
      await api.delete(`/time/${e._id}`);
      toast('Entry deleted.', 'success');
      setConfirm(null);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed.', 'error');
    }
  };

  const approve = async (id, action) => {
    try {
      await api.put(`/time/${id}/approve`, { action });
      toast(`Entry ${action}d.`, 'success');
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
          <h1 className="text-xl font-bold text-slate-100 mb-0.5">Time Tracking</h1>
          <p className="text-sm text-slate-500">Log billable hours per task</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setModal(true); }}>+ Log Time</button>
      </div>

      {/* Live Timer */}
      <div className="card mb-5 border-amber-400/20">
        <p className="text-sm font-semibold text-slate-300 mb-3">⏱ Live Timer</p>
        <div className="flex items-center gap-4 flex-wrap">
          <select className="input flex-1 min-w-[200px] bg-slate-800 border-slate-700"
            value={timerTaskId} onChange={e => setTimerTaskId(e.target.value)} disabled={timerOn}>
            <option value="">Select task to track…</option>
            {tasks.map(t => <option key={t._id} value={t._id}>{t.title} — {t.clientId?.name}</option>)}
          </select>
          <div className={`text-3xl font-mono font-bold transition-colors ${timerOn ? 'text-amber-400' : 'text-slate-500'}`}>
            {fmtTimer(timerSecs)}
          </div>
          {!timerOn
            ? <button className="btn-primary" onClick={startTimer}>▶ Start</button>
            : <button className="btn-danger"  onClick={stopTimer} >■ Stop & Log</button>
          }
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label:'Total Hours',    val: fmtMins(summary.totalMins),    color:'text-slate-300'  },
            { label:'Billable Hours', val: fmtMins(summary.billableMins), color:'text-amber-400'  },
            { label:'Total Billed',   val: fmtAmt(summary.totalBilledAmount), color:'text-emerald-400' },
            { label:'Entries',        val: entries.length,               color:'text-slate-300'  },
          ].map(s => (
            <div key={s.label} className="card">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2.5 mb-5 flex-wrap">
        {isAdmin && (
          <select className="input w-auto bg-[#0f172a] border-slate-800 text-xs py-2"
            value={filt.userId} onChange={e => setFilt(f => ({ ...f, userId: e.target.value }))}>
            <option value="">All Employees</option>
            {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        )}
        <input type="date" className="input w-auto bg-[#0f172a] border-slate-800 text-xs py-2"
          value={filt.from} onChange={e => setFilt(f => ({ ...f, from: e.target.value }))} />
        <input type="date" className="input w-auto bg-[#0f172a] border-slate-800 text-xs py-2"
          value={filt.to} onChange={e => setFilt(f => ({ ...f, to: e.target.value }))} />
        {(filt.userId || filt.from || filt.to) && (
          <button className="btn-outline text-xs py-2 px-3" onClick={() => setFilt({ userId:'', from:'', to:'' })}>Clear</button>
        )}
      </div>

      {/* Entries table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead><tr>
            <th className="th">Date</th>
            {isAdmin && <th className="th">Employee</th>}
            <th className="th">Task</th>
            <th className="th">Client</th>
            <th className="th">Duration</th>
            <th className="th">Billable</th>
            <th className="th">Amount</th>
            <th className="th">Status</th>
            <th className="th"></th>
          </tr></thead>
          <tbody>
            {loading
              ? [1,2,3].map(i => <tr key={i}><td colSpan="9" className="td"><div className="skeleton h-4 w-full rounded" /></td></tr>)
              : entries.map(e => (
                <tr key={e._id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="td text-xs text-slate-400">{fmtDate(e.date)}</td>
                  {isAdmin && <td className="td text-xs text-slate-300">{e.userId?.name?.split(' ')[0]}</td>}
                  <td className="td">
                    <p className="text-slate-200 font-medium text-xs leading-tight">{e.taskId?.title}</p>
                    {e.description && <p className="text-slate-500 text-xs mt-0.5">{e.description}</p>}
                  </td>
                  <td className="td text-xs text-slate-400">{e.clientId?.name}</td>
                  <td className="td text-amber-400 font-semibold text-xs">{fmtMins(e.durationMins)}</td>
                  <td className="td">
                    <span className={`badge text-xs ${e.isBillable ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-500 bg-slate-800'}`}>
                      {e.isBillable ? 'Billable' : 'Non-bill'}
                    </span>
                  </td>
                  <td className="td text-xs text-slate-300">{fmtAmt(e.billedAmount)}</td>
                  <td className="td">
                    <span className={`badge text-xs ${e.status==='approved' ? 'text-emerald-400 bg-emerald-400/10' : e.status==='rejected' ? 'text-red-400 bg-red-400/10' : 'text-amber-400 bg-amber-400/10'}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex gap-1.5">
                      {isAdmin && e.status === 'pending' && (
                        <>
                          <button className="text-xs text-emerald-400 hover:bg-emerald-400/10 px-2 py-1 rounded-lg transition-colors" onClick={() => approve(e._id, 'approve')}>✓</button>
                          <button className="text-xs text-red-400 hover:bg-red-400/10 px-2 py-1 rounded-lg transition-colors" onClick={() => approve(e._id, 'reject')}>✕</button>
                        </>
                      )}
                      <button className="btn-ghost text-xs hover:text-red-400 hover:bg-red-400/10 px-2"
                        onClick={() => setConfirm(e)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
        {!loading && entries.length === 0 && (
          <EmptyState title="No time entries" sub="Start the live timer or log time manually." />
        )}
      </div>

      {/* Log time modal */}
      {modal && (
        <Modal title="Log Time" onClose={() => setModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Task *</label>
              <select className="input" value={form.taskId} onChange={setF('taskId')}>
                <option value="">Select task</option>
                {tasks.map(t => <option key={t._id} value={t._id}>{t.title} — {t.clientId?.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
                <input className="input" type="date" value={form.date} onChange={setF('date')} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Duration (mins) *</label>
                <input className="input" type="number" min="1" value={form.durationMins} onChange={setF('durationMins')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Start Time</label>
                <input className="input" type="time" value={form.startTime} onChange={setF('startTime')} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">End Time</label>
                <input className="input" type="time" value={form.endTime} onChange={setF('endTime')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Hourly Rate (₹)</label>
                <input className="input" type="number" min="0" value={form.hourlyRate} onChange={setF('hourlyRate')} placeholder="0" />
              </div>
              <div className="flex items-end pb-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.isBillable} onChange={e => setForm(f => ({ ...f, isBillable: e.target.checked }))} className="w-4 h-4 accent-amber-400" />
                  <span className="text-sm text-slate-300">Billable</span>
                </label>
              </div>
            </div>
            {form.hourlyRate > 0 && form.durationMins > 0 && (
              <div className="p-3 bg-emerald-400/5 border border-emerald-400/20 rounded-lg">
                <p className="text-sm text-emerald-300">
                  Billed amount: <strong>₹{Math.round((form.durationMins/60)*form.hourlyRate).toLocaleString('en-IN')}</strong>
                </p>
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
              <textarea className="input" rows={2} placeholder="What did you work on?" value={form.description} onChange={setF('description')} />
            </div>
            <div className="flex gap-3">
              <button className="btn-primary flex-1 justify-center" onClick={save}>Log Time</button>
              <button className="btn-outline flex-1 justify-center" onClick={() => setModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          title="Delete time entry?"
          message="This will permanently remove the time log."
          onConfirm={() => del(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
