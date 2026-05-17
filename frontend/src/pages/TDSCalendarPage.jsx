import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Modal, EmptyState, SkeletonRow, Field } from '../components/index.jsx';

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const isOD    = d => new Date(d) < new Date();

const QUARTERS = [
  { value: 1, label: 'Q1 (Apr - Jun)' },
  { value: 2, label: 'Q2 (Jul - Sep)' },
  { value: 3, label: 'Q3 (Oct - Dec)' },
  { value: 4, label: 'Q4 (Jan - Mar)' },
];

export default function TDSCalendarPage() {
  const { toast } = useToast();
  const { socket } = useAuth();
  
  // Default to current FY quarter
  const [quarter, setQuarter] = useState(() => {
    const m = new Date().getMonth() + 1;
    if (m >= 4 && m <= 6) return 1;
    if (m >= 7 && m <= 9) return 2;
    if (m >= 10 && m <= 12) return 3;
    return 4;
  });
  const [year, setYear] = useState(() => {
    const d = new Date();
    return d.getMonth() + 1 < 4 ? d.getFullYear() - 1 : d.getFullYear();
  });

  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [users, setUsers]     = useState([]);
  const [types, setTypes]     = useState({});

  const [genModal, setGenModal] = useState(false);
  const [genForm, setGenForm]   = useState({ clientId: '', returnTypes: [], assignedTo: '' });
  const [generating, setGenerating] = useState(false);

  useEffect(() => { document.title = 'TDS Calendar | CA Firm Pro'; }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [cal, c, u, t] = await Promise.all([
        api.get(`/tds/calendar?quarter=${quarter}&year=${year}`),
        api.get('/clients?limit=200'),
        api.get('/users'),
        api.get('/tds/return-types'),
      ]);
      setData(cal.data.data);
      setClients(c.data.data.clients.filter(cl => cl.isTdsRequired));
      setUsers(u.data.data);
      setTypes(t.data.data);
    } catch (err) {
      toast('Failed to load TDS calendar', 'error');
    } finally {
      setLoading(false);
    }
  }, [quarter, year, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (data.type === 'tds') load();
    };
    socket.on('firm_data_updated', handler);
    return () => socket.off('firm_data_updated', handler);
  }, [socket, load]);

  const handleGen = async () => {
    if (!genForm.clientId || genForm.returnTypes.length === 0) return toast('Select a client and at least one return type.', 'warning');
    setGenerating(true);
    try {
      await api.post('/tds/generate', genForm);
      toast('TDS filings scheduled successfully.', 'success');
      setGenModal(false);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Generation failed.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleType = (rt) => {
    setGenForm(f => ({
      ...f,
      returnTypes: f.returnTypes.includes(rt) ? f.returnTypes.filter(x => x !== rt) : [...f.returnTypes, rt]
    }));
  };

  const handleMarkFiled = async (filingId) => {
    try {
      await api.put(`/tds/${filingId}/file`, { filedDate: new Date() });
      toast('Marked as filed.', 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed.', 'error');
    }
  };

  const handleCreateTask = async (filing) => {
    try {
      await api.post(`/tds/${filing._id}/create-task`);
      toast('Task created from this filing.', 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed.', 'error');
    }
  };

  const handleRemoveSchedule = async (clientId, returnType) => {
    if (!window.confirm(`Stop tracking ${returnType} for this client? Future unfiled returns will be deleted.`)) return;
    try {
      await api.delete(`/tds/client/${clientId}/return/${returnType}`);
      toast(`${returnType} tracking stopped.`, 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to remove.', 'error');
    }
  };

  const prevQuarter = () => { if (quarter === 1) { setQuarter(4); setYear(y => y-1); } else setQuarter(q => q-1); };
  const nextQuarter = () => { if (quarter === 4) { setQuarter(1); setYear(y => y+1); } else setQuarter(q => q+1); };

  const getQuarterName = (q) => QUARTERS.find(x => x.value === q)?.label || `Q${q}`;

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100 mb-0.5">TDS Calendar</h1>
          <p className="text-sm text-slate-500">Track quarterly TDS and TCS returns</p>
        </div>
        <button className="btn-primary" onClick={() => { setGenForm({ clientId:'', returnTypes:[], assignedTo:'' }); setGenModal(true); }}>
          + Schedule Filings
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6 bg-[#0f172a] border border-slate-800 p-2 rounded-xl w-fit">
        <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400" onClick={prevQuarter}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex flex-col items-center min-w-[140px]">
          <span className="font-bold text-amber-500">{getQuarterName(quarter)}</span>
          <span className="text-xs text-slate-400 font-mono mt-0.5">FY {year}-{String(year+1).slice(2)}</span>
        </div>
        <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400" onClick={nextQuarter}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-4">
            {[1,2,3].map(i => <SkeletonRow key={i} />)}
          </div>
        ) : data.length === 0 ? (
          <EmptyState 
            title="No TDS filings for this quarter" 
            sub="No clients are subscribed to TDS returns yet, or there are no active returns this quarter." 
            action={<button className="btn-outline mt-4" onClick={() => { setGenForm({ clientId:'', returnTypes:[], assignedTo:'' }); setGenModal(true); }}>Subscribe Client</button>} 
          />
        ) : (
          <div className="divide-y divide-slate-800/50">
            {data.map(({ client, filings }) => {
              // Group filings by return type to display them nicely
              const filedAll = filings.every(f => f.status === 'filed');
              const hasOverdue = filings.some(f => f.status === 'overdue' || (f.status === 'pending' && isOD(f.dueDate)));
              
              return (
                <div key={client._id} className={`p-4 transition-colors hover:bg-slate-800/20 flex items-start gap-4 ${filedAll ? 'opacity-70' : ''}`}>
                  <div className="w-1/4 min-w-[200px]">
                    <h3 className="font-semibold text-slate-200">{client.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {hasOverdue && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>}
                      <span className="text-xs font-mono text-slate-500">{client.pan || 'NO PAN'}</span>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-2">
                    {filings.map(f => (
                      <div key={f._id} className={`flex items-center justify-between p-3 rounded-lg border ${f.status === 'filed' ? 'border-emerald-400/20 bg-emerald-400/[0.02]' : (f.status === 'overdue' || (f.status==='pending'&&isOD(f.dueDate))) ? 'border-red-400/20 bg-red-400/[0.03]' : 'border-slate-700 bg-slate-800/30'}`}>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-amber-400 font-semibold text-xs bg-amber-400/10 px-2 py-1 rounded w-16 text-center">{f.returnType}</span>
                            <button className="text-slate-500 hover:text-red-400 p-0.5 rounded-md hover:bg-slate-800" title="Stop tracking this return" onClick={() => handleRemoveSchedule(client._id, f.returnType)}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                          <div className="flex flex-col w-32">
                            <span className="text-xs font-medium" style={{ color: (f.status === 'overdue' || (f.status==='pending'&&isOD(f.dueDate))) ? '#f87171' : '#94a3b8' }}>Due: {fmtDate(f.dueDate)}</span>
                            {f.filedDate && <span className="text-[10px] text-slate-500 mt-0.5">Filed: {fmtDate(f.filedDate)}</span>}
                          </div>
                          <div className="w-24">
                            {f.status === 'filed' ? (
                              <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">Filed</span>
                            ) : (f.status === 'overdue' || isOD(f.dueDate)) ? (
                              <span className="text-[10px] uppercase tracking-wider font-semibold text-red-400 bg-red-400/10 px-2 py-1 rounded">Overdue</span>
                            ) : (
                              <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-500 bg-amber-500/10 px-2 py-1 rounded">Pending</span>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {f.status !== 'filed' && (
                            <>
                              {!f.taskId && (
                                <button className="text-xs text-amber-400 border border-amber-400/30 hover:bg-amber-400/10 px-3 py-1.5 rounded-lg transition-colors" onClick={() => handleCreateTask(f)}>
                                  + Task
                                </button>
                              )}
                              {f.taskId && <span className="text-xs flex items-center px-3 py-1.5 border border-emerald-400/20 text-emerald-400 bg-emerald-400/5 rounded-lg">✓ Task</span>}
                              <button className="text-xs text-slate-100 bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-lg font-medium transition-colors" onClick={() => handleMarkFiled(f._id)}>
                                Mark Filed
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {genModal && (
        <Modal title="Schedule TDS Filings" onClose={() => setGenModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Client *</label>
              <select className="input" value={genForm.clientId} onChange={e => setGenForm(f => ({ ...f, clientId: e.target.value }))}>
                <option value="">Select a client (TDS enabled)</option>
                {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              {clients.length === 0 && <p className="text-xs text-amber-500 mt-1">No clients have "TDS Required" enabled. Enable it in the Clients tab first.</p>}
            </div>

            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Quarterly Returns to Track *</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(types).map(([rt, def]) => {
                  const sel = genForm.returnTypes.includes(rt);
                  return (
                    <div key={rt} onClick={() => handleToggleType(rt)} className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center gap-3 ${sel ? 'border-amber-400 bg-amber-400/5' : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'}`}>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${sel ? 'border-amber-400 bg-amber-400' : 'border-slate-500'}`}>
                        {sel && <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${sel ? 'text-amber-400' : 'text-slate-200'}`}>{rt}</p>
                        <p className="text-[10px] text-slate-500">{def.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Default Assignee</label>
              <select className="input" value={genForm.assignedTo} onChange={e => setGenForm(f => ({ ...f, assignedTo: e.target.value }))}>
                <option value="">Auto-assign (None)</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-primary flex-1 justify-center" onClick={handleGen} disabled={generating || clients.length === 0}>
                {generating ? 'Scheduling...' : 'Schedule & Generate'}
              </button>
              <button className="btn-outline flex-1 justify-center" onClick={() => setGenModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
