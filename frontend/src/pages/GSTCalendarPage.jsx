import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Modal, ConfirmModal, EmptyState, StatusBadge } from '../components/index.jsx';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
const isOverdue = d => new Date(d) < new Date();

const statusCls = s => ({
  filed:       'text-emerald-400 bg-emerald-400/10',
  pending:     'text-amber-400   bg-amber-400/10',
  overdue:     'text-red-400     bg-red-400/10',
  in_progress: 'text-blue-400   bg-blue-400/10',
})[s] || 'text-slate-400 bg-slate-400/10';

export default function GSTCalendarPage() {
  const { toast } = useToast();
  const { socket } = useAuth();
  const now = new Date();
  const [month,    setMonth]    = useState(now.getMonth() + 1);
  const [year,     setYear]     = useState(now.getFullYear());
  const [data,     setData]     = useState(null);
  const [clients,  setClients]  = useState([]);
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [upcoming, setUpcoming] = useState([]);
  const [genModal, setGenModal] = useState(false);
  const [fileModal,setFileModal]= useState(null); // filing to mark as filed
  const [genForm,  setGenForm]  = useState({ clientId:'', returnTypes:[], assignedTo:'' });
  const [fileForm, setFileForm] = useState({ filedDate:'', turnover:'', taxPayable:'', lateFee:'', notes:'' });

  const RETURN_TYPES = ['GSTR-1','GSTR-3B','GSTR-2B','GSTR-9','GSTR-9C','CMP-08'];

  useEffect(() => { document.title = 'GST Calendar | CA Firm Pro'; }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [cal, up, cl, us] = await Promise.all([
        api.get(`/gst/calendar?month=${month}&year=${year}`),
        api.get('/gst/upcoming'),
        api.get('/clients?limit=200'),
        api.get('/users'),
      ]);
      setData(cal.data.data);
      setUpcoming(up.data.data);
      setClients(cl.data.data.clients);
      setUsers(us.data.data);
    } finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (data.type === 'gst') load();
    };
    socket.on('firm_data_updated', handler);
    return () => socket.off('firm_data_updated', handler);
  }, [socket, load]);

  const toggleReturnType = (rt) => {
    setGenForm(f => ({
      ...f,
      returnTypes: f.returnTypes.includes(rt)
        ? f.returnTypes.filter(x => x !== rt)
        : [...f.returnTypes, rt],
    }));
  };

  const handleGenerate = async () => {
    if (!genForm.clientId || !genForm.returnTypes.length) {
      return toast('Select a client and at least one return type.', 'warning');
    }
    try {
      const res = await api.post('/gst/generate', genForm);
      toast(res.data.message, 'success');
      setGenModal(false);
      setGenForm({ clientId:'', returnTypes:[], assignedTo:'' });
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to generate.', 'error');
    }
  };

  const handleMarkFiled = async () => {
    if (!fileModal) return;
    try {
      await api.put(`/gst/${fileModal._id}/file`, fileForm);
      toast(`${fileModal.returnType} marked as filed.`, 'success');
      setFileModal(null);
      setFileForm({ filedDate:'', turnover:'', taxPayable:'', lateFee:'', notes:'' });
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed.', 'error');
    }
  };

  const handleCreateTask = async (filing) => {
    try {
      const res = await api.post(`/gst/${filing._id}/create-task`);
      toast('Task created from this filing.', 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed.', 'error');
    }
  };

  const handleRemoveSchedule = async (clientId, returnType) => {
    if (!window.confirm(`Stop tracking ${returnType} for this client? Future unfiled returns will be deleted.`)) return;
    try {
      await api.delete(`/gst/client/${clientId}/return/${returnType}`);
      toast(`${returnType} tracking stopped.`, 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to remove.', 'error');
    }
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y+1); } else setMonth(m => m+1); };

  return (
    <>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 mb-0.5">GST Calendar</h1>
          <p className="text-sm text-slate-500">Track all GST filing deadlines across clients</p>
        </div>
        <button className="btn-primary" onClick={() => setGenModal(true)}>
          + Schedule Filings
        </button>
      </div>

      {/* Upcoming alerts */}
      {upcoming.length > 0 && (
        <div className="mb-5 p-4 bg-amber-400/5 border border-amber-400/20 rounded-xl">
          <p className="text-sm font-semibold text-amber-300 mb-3">
            ⚠️ {upcoming.length} filing{upcoming.length > 1 ? 's' : ''} due in the next 30 days
          </p>
          <div className="flex flex-wrap gap-2">
            {upcoming.slice(0, 5).map(f => (
              <span key={f._id} className="text-xs bg-amber-400/10 text-amber-300 px-3 py-1 rounded-full">
                {f.returnType} — {f.clientId?.name} — {fmtDate(f.dueDate)}
              </span>
            ))}
            {upcoming.length > 5 && <span className="text-xs text-slate-500">+{upcoming.length - 5} more</span>}
          </div>
        </div>
      )}

      {/* Month navigation + summary */}
      <div className="card mb-5">
        <div className="flex items-center justify-between mb-5">
          <button className="btn-outline px-3 py-1.5 text-sm" onClick={prevMonth}>← Prev</button>
          <h2 className="text-lg font-bold text-slate-100">{FULL_MONTHS[month-1]} {year}</h2>
          <button className="btn-outline px-3 py-1.5 text-sm" onClick={nextMonth}>Next →</button>
        </div>

        {/* Summary pills */}
        {data && (
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label:'Total',    val: data.summary.total,   color:'text-slate-300' },
              { label:'Filed',    val: data.summary.filed,   color:'text-emerald-400' },
              { label:'Pending',  val: data.summary.pending, color:'text-amber-400' },
              { label:'Overdue',  val: data.summary.overdue, color:'text-red-400' },
            ].map(s => (
              <div key={s.label} className="text-center p-3 bg-slate-800/50 rounded-xl">
                <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filing table */}
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>
        ) : data?.filings?.length > 0 ? (
          (() => {
            const grouped = {};
            data.filings.forEach(f => {
              const cId = f.clientId?._id || 'unknown';
              if (!grouped[cId]) grouped[cId] = [];
              grouped[cId].push(f);
            });
            const groupedFilingsArray = Object.values(grouped);
            
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead><tr>
                    <th className="th w-1/4">Client</th>
                    <th className="th w-1/6">Assigned To</th>
                    <th className="th">Filings</th>
                  </tr></thead>
                  <tbody>
                    {groupedFilingsArray.map(group => {
                      const client = group[0].clientId;
                      const assignedTo = group[0].assignedTo;
                      return (
                        <tr key={client?._id || Math.random()} className="border-b border-slate-800/50 last:border-0">
                          <td className="td text-slate-300 font-medium align-top pt-5">{client?.name}</td>
                          <td className="td text-slate-500 text-xs align-top pt-5">{assignedTo?.name?.split(' ')[0] || '—'}</td>
                          <td className="td p-0">
                            <div className="flex flex-col divide-y divide-slate-800/50">
                              {group.map(f => (
                                <div key={f._id} className={`flex items-center justify-between p-3 hover:bg-slate-800/30 transition-colors ${f.status === 'overdue' ? 'bg-red-500/[0.03]' : ''}`}>
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1">
                                      <span className="font-mono text-amber-400 font-semibold text-xs bg-amber-400/10 px-2 py-1 rounded w-20 text-center">{f.returnType}</span>
                                      <button className="text-slate-500 hover:text-red-400 p-0.5 rounded-md hover:bg-slate-800" title="Stop tracking this return" onClick={() => handleRemoveSchedule(client._id, f.returnType)}>
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                      </button>
                                    </div>
                                    <div className="flex flex-col w-32">
                                      <span className="text-xs font-medium" style={{ color: f.status === 'overdue' ? '#f87171' : '#94a3b8' }}>Due: {fmtDate(f.dueDate)}</span>
                                      {f.filedDate && <span className="text-[10px] text-slate-500 mt-0.5">Filed: {fmtDate(f.filedDate)}</span>}
                                    </div>
                                    <span className={`badge capitalize text-[10px] w-24 text-center justify-center ${statusCls(f.status)}`}>{f.status.replace('_',' ')}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    {f.status !== 'filed' && (
                                      <button className="btn-primary text-xs py-1 px-3" onClick={() => setFileModal(f)}>
                                        Mark Filed
                                      </button>
                                    )}
                                    {!f.taskId && f.status !== 'filed' && (
                                      <button className="btn-outline text-xs py-1 px-3" onClick={() => handleCreateTask(f)}>
                                        + Task
                                      </button>
                                    )}
                                    {f.taskId && (
                                      <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">✓ Task</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()
        ) : (
          <EmptyState
            title="No filings scheduled"
            sub={`No GST filings for ${FULL_MONTHS[month-1]} ${year}. Click "Schedule Filings" to add.`}
            action={<button className="btn-primary" onClick={() => setGenModal(true)}>+ Schedule Filings</button>}
          />
        )}
      </div>

      {/* Generate modal */}
      {genModal && (
        <Modal title="Schedule GST Filings" onClose={() => setGenModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Client *</label>
              <select className="input" value={genForm.clientId} onChange={e => setGenForm(f => ({ ...f, clientId: e.target.value }))}>
                <option value="">Select client</option>
                {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Return Types * (select all that apply)</label>
              <div className="flex flex-wrap gap-2">
                {RETURN_TYPES.map(rt => (
                  <button key={rt} onClick={() => toggleReturnType(rt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      genForm.returnTypes.includes(rt)
                        ? 'bg-amber-400 text-slate-900 border-amber-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-amber-400/50'
                    }`}>
                    {rt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Assign To</label>
              <select className="input" value={genForm.assignedTo} onChange={e => setGenForm(f => ({ ...f, assignedTo: e.target.value }))}>
                <option value="">Select employee (optional)</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            </div>
            <p className="text-xs text-slate-500">Filings will be created for the current month and next 2 months.</p>
            <div className="flex gap-3">
              <button className="btn-primary flex-1 justify-center" onClick={handleGenerate}>Generate Schedule</button>
              <button className="btn-outline flex-1 justify-center" onClick={() => setGenModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Mark filed modal */}
      {fileModal && (
        <Modal title={`Mark ${fileModal.returnType} as Filed`} onClose={() => setFileModal(null)}>
          <div className="space-y-3">
            <div className="p-3 bg-slate-800/50 rounded-lg mb-4">
              <p className="text-sm text-slate-300"><strong>{fileModal.returnType}</strong> — {fileModal.clientId?.name}</p>
              <p className="text-xs text-slate-500">Due: {fmtDate(fileModal.dueDate)}</p>
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Date Filed</label>
              <input className="input" type="date" value={fileForm.filedDate} onChange={e => setFileForm(f => ({ ...f, filedDate: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Turnover (₹)</label>
                <input className="input" type="number" placeholder="0" value={fileForm.turnover} onChange={e => setFileForm(f => ({ ...f, turnover: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Tax Payable (₹)</label>
                <input className="input" type="number" placeholder="0" value={fileForm.taxPayable} onChange={e => setFileForm(f => ({ ...f, taxPayable: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Late Fee (₹)</label>
              <input className="input" type="number" placeholder="0" value={fileForm.lateFee} onChange={e => setFileForm(f => ({ ...f, lateFee: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
              <textarea className="input" rows={2} value={fileForm.notes} onChange={e => setFileForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button className="btn-primary flex-1 justify-center" onClick={handleMarkFiled}>Confirm Filed</button>
              <button className="btn-outline flex-1 justify-center" onClick={() => setFileModal(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
