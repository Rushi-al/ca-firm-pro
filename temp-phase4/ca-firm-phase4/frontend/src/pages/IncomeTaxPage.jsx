import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { Modal, ConfirmModal, EmptyState } from '../components/index.jsx';

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const fmtAmt  = a => a != null ? `₹${Number(a).toLocaleString('en-IN')}` : '—';
const isOD    = d => new Date(d) < new Date();

const STATUS_CLS = {
  filed:       'text-emerald-400 bg-emerald-400/10',
  revised:     'text-blue-400   bg-blue-400/10',
  in_progress: 'text-amber-400  bg-amber-400/10',
  not_started: 'text-slate-400  bg-slate-400/10',
  overdue:     'text-red-400    bg-red-400/10',
};

// Current and previous assessment years
const AY_OPTIONS = (() => {
  const now = new Date(), month = now.getMonth()+1, year = now.getFullYear();
  const curr = month >= 4 ? year : year-1;
  return [0,1,2].map(i => {
    const y = curr - i;
    return `${y}-${String(y+1).slice(2)}`;
  });
})();

const EMPTY_FORM = {
  clientId:'', itrForm:'ITR-1', assessmentYear: AY_OPTIONS[0],
  financialYear:'', assignedTo:'', notes:'',
};

const EMPTY_UPDATE = {
  status:'in_progress', filedDate:'', ackNumber:'',
  grossIncome:'', taxableIncome:'', taxPayable:'', taxPaid:'',
  refundAmount:'', interestPayable:'',
  deductions: { section80C:0, section80D:0, section80G:0, other:0 },
  notes:'',
};

export default function IncomeTaxPage() {
  const { toast }   = useToast();
  const [records,   setRecords]   = useState([]);
  const [summary,   setSummary]   = useState(null);
  const [upcoming,  setUpcoming]  = useState([]);
  const [clients,   setClients]   = useState([]);
  const [users,     setUsers]     = useState([]);
  const [itrForms,  setItrForms]  = useState({});
  const [loading,   setLoading]   = useState(true);
  const [filt,      setFilt]      = useState({ assessmentYear:'', status:'' });
  const [addModal,  setAddModal]  = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [upd,       setUpd]       = useState(EMPTY_UPDATE);
  const [confirm,   setConfirm]   = useState(null);

  useEffect(() => { document.title = 'Income Tax | CA Firm Pro'; }, []);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filt.assessmentYear) params.set('assessmentYear', filt.assessmentYear);
      if (filt.status)         params.set('status',         filt.status);
      const [r, up, c, u, f] = await Promise.all([
        api.get(`/itr?${params}`),
        api.get('/itr/upcoming'),
        api.get('/clients?limit=200'),
        api.get('/users'),
        api.get('/itr/forms'),
      ]);
      setRecords(r.data.data.records);
      setSummary(r.data.data.summary);
      setUpcoming(up.data.data);
      setClients(c.data.data.clients);
      setUsers(u.data.data);
      setItrForms(f.data.data);
    } finally { setLoading(false); }
  }, [filt]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(EMPTY_FORM); setAddModal(true); };

  const openEdit = rec => {
    setUpd({
      status:          rec.status,
      filedDate:       rec.filedDate?.split('T')[0]  || '',
      ackNumber:       rec.ackNumber  || '',
      grossIncome:     rec.grossIncome     || '',
      taxableIncome:   rec.taxableIncome   || '',
      taxPayable:      rec.taxPayable      || '',
      taxPaid:         rec.taxPaid         || '',
      refundAmount:    rec.refundAmount    || '',
      interestPayable: rec.interestPayable || '',
      deductions:      rec.deductions || { section80C:0, section80D:0, section80G:0, other:0 },
      notes:           rec.notes || '',
    });
    setEditModal(rec);
  };

  const saveAdd = async () => {
    if (!form.clientId || !form.itrForm || !form.assessmentYear) {
      return toast('Client, ITR form and assessment year are required.', 'warning');
    }
    try {
      await api.post('/itr', form);
      toast('ITR record created.', 'success');
      setAddModal(false);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed.', 'error');
    }
  };

  const saveEdit = async () => {
    try {
      await api.put(`/itr/${editModal._id}`, upd);
      toast('ITR record updated.', 'success');
      setEditModal(null);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed.', 'error');
    }
  };

  const createTask = async (rec) => {
    try {
      await api.post(`/itr/${rec._id}/create-task`);
      toast('Task created from ITR filing.', 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed.', 'error');
    }
  };

  const del = async (rec) => {
    try {
      await api.delete(`/itr/${rec._id}`);
      toast('Record deleted.', 'success');
      setConfirm(null);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed.', 'error');
    }
  };

  const setF  = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setU  = k => e => setUpd(u => ({ ...u, [k]: e.target.value }));
  const setUD = k => e => setUpd(u => ({ ...u, deductions: { ...u.deductions, [k]: e.target.value } }));

  return (
    <>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 mb-0.5">Income Tax Tracker</h1>
          <p className="text-sm text-slate-500">ITR filings, advance tax, and AY-wise tracking</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add ITR Record</button>
      </div>

      {/* Upcoming alerts */}
      {upcoming.length > 0 && (
        <div className="mb-5 p-4 bg-red-400/5 border border-red-400/20 rounded-xl">
          <p className="text-sm font-semibold text-red-300 mb-2">⚠️ {upcoming.length} ITR deadline{upcoming.length>1?'s':''} in next 60 days</p>
          <div className="flex flex-wrap gap-2">
            {upcoming.slice(0,5).map(r => (
              <span key={r._id} className="text-xs bg-red-400/10 text-red-300 px-3 py-1 rounded-full">
                {r.itrForm} — {r.clientId?.name} — {fmtDate(r.dueDate)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label:'Total',       val:summary.total,       color:'text-slate-300'  },
            { label:'Filed',       val:summary.filed,       color:'text-emerald-400'},
            { label:'In Progress', val:summary.in_progress, color:'text-amber-400'  },
            { label:'Not Started', val:summary.not_started, color:'text-slate-500'  },
            { label:'Overdue',     val:summary.overdue,     color:'text-red-400'    },
          ].map(s => (
            <div key={s.label} className="card text-center py-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2.5 mb-5 flex-wrap">
        <select className="input w-auto bg-[#0f172a] border-slate-800 text-xs py-2"
          value={filt.assessmentYear} onChange={e => setFilt(f=>({...f,assessmentYear:e.target.value}))}>
          <option value="">All Assessment Years</option>
          {AY_OPTIONS.map(ay => <option key={ay} value={ay}>AY {ay}</option>)}
        </select>
        <select className="input w-auto bg-[#0f172a] border-slate-800 text-xs py-2"
          value={filt.status} onChange={e => setFilt(f=>({...f,status:e.target.value}))}>
          <option value="">All Statuses</option>
          {['not_started','in_progress','filed','revised','overdue'].map(s => (
            <option key={s} value={s}>{s.replace('_',' ')}</option>
          ))}
        </select>
        {(filt.assessmentYear||filt.status) && (
          <button className="btn-outline text-xs py-2 px-3" onClick={() => setFilt({assessmentYear:'',status:''})}>Clear</button>
        )}
      </div>

      {/* Records table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr>
            <th className="th">Client</th><th className="th">Form</th><th className="th">AY</th>
            <th className="th">Due Date</th><th className="th">Filed On</th>
            <th className="th">Tax Payable</th><th className="th">Ack #</th>
            <th className="th">Status</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {loading
              ? [1,2,3].map(i => <tr key={i}><td colSpan="9" className="td"><div className="skeleton h-4 rounded" /></td></tr>)
              : records.map(r => {
                const od = isOD(r.dueDate) && !['filed','revised'].includes(r.status);
                return (
                  <tr key={r._id} className={`hover:bg-slate-800/30 transition-colors ${od?'bg-red-500/[0.03]':''}`}>
                    <td className="td font-semibold text-slate-100">{r.clientId?.name}</td>
                    <td className="td">
                      <span className="font-mono text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">{r.itrForm}</span>
                    </td>
                    <td className="td text-xs text-slate-400">AY {r.assessmentYear}</td>
                    <td className="td text-xs" style={{color: od?'#f87171':'#94a3b8'}}>{fmtDate(r.dueDate)}</td>
                    <td className="td text-xs text-slate-400">{fmtDate(r.filedDate)}</td>
                    <td className="td text-xs text-slate-300">{fmtAmt(r.taxPayable)}</td>
                    <td className="td text-xs text-slate-500 font-mono">{r.ackNumber || '—'}</td>
                    <td className="td">
                      <span className={`badge capitalize text-xs ${STATUS_CLS[r.status]}`}>{r.status.replace('_',' ')}</span>
                    </td>
                    <td className="td">
                      <div className="flex gap-1.5">
                        <button className="btn-ghost text-xs px-2 py-1" onClick={() => openEdit(r)}>Edit</button>
                        {!r.taskId && !['filed','revised'].includes(r.status) && (
                          <button className="text-xs text-amber-400 hover:bg-amber-400/10 px-2 py-1 rounded-lg transition-colors" onClick={() => createTask(r)}>+ Task</button>
                        )}
                        {r.taskId && <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-lg">✓ Task</span>}
                        <button className="btn-ghost text-xs px-1.5 hover:text-red-400 hover:bg-red-400/10" onClick={() => setConfirm(r)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
        {!loading && records.length === 0 && (
          <EmptyState title="No ITR records" sub="Add your first ITR record to start tracking." action={<button className="btn-primary" onClick={openAdd}>+ Add ITR Record</button>} />
        )}
      </div>

      {/* Add modal */}
      {addModal && (
        <Modal title="Add ITR Record" onClose={() => setAddModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Client *</label>
              <select className="input" value={form.clientId} onChange={setF('clientId')}>
                <option value="">Select client</option>
                {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">ITR Form *</label>
                <select className="input" value={form.itrForm} onChange={setF('itrForm')}>
                  {Object.entries(itrForms).map(([k,v]) => <option key={k} value={k}>{k} — {v.description?.slice(0,30)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Assessment Year *</label>
                <select className="input" value={form.assessmentYear} onChange={setF('assessmentYear')}>
                  {AY_OPTIONS.map(ay => <option key={ay} value={ay}>AY {ay}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Assign To</label>
              <select className="input" value={form.assignedTo} onChange={setF('assignedTo')}>
                <option value="">Select employee</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={setF('notes')} />
            </div>
            <div className="flex gap-3">
              <button className="btn-primary flex-1 justify-center" onClick={saveAdd}>Add Record</button>
              <button className="btn-outline flex-1 justify-center" onClick={() => setAddModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit / update modal */}
      {editModal && (
        <Modal title={`Update ${editModal.itrForm} — ${editModal.clientId?.name}`} onClose={() => setEditModal(null)} maxWidth="max-w-2xl">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
              <select className="input" value={upd.status} onChange={setU('status')}>
                {['not_started','in_progress','filed','revised'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Filed Date</label>
              <input className="input" type="date" value={upd.filedDate} onChange={setU('filedDate')} />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Acknowledgement Number</label>
            <input className="input" placeholder="ITR-V ack number" value={upd.ackNumber} onChange={setU('ackNumber')} />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[['grossIncome','Gross Income (₹)'],['taxableIncome','Taxable Income (₹)'],['taxPayable','Tax Payable (₹)'],['taxPaid','Tax Paid (₹)'],['refundAmount','Refund (₹)'],['interestPayable','Interest (₹)']].map(([k,l]) => (
              <div key={k}>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">{l}</label>
                <input className="input" type="number" min="0" value={upd[k]} onChange={setU(k)} />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Deductions</p>
          <div className="grid grid-cols-4 gap-3 mb-3">
            {[['section80C','80C'],['section80D','80D'],['section80G','80G'],['other','Other']].map(([k,l]) => (
              <div key={k}>
                <label className="block text-xs text-slate-500 mb-1">{l}</label>
                <input className="input" type="number" min="0" value={upd.deductions[k]} onChange={setUD(k)} />
              </div>
            ))}
          </div>
          <div className="mb-4">
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea className="input" rows={2} value={upd.notes} onChange={setU('notes')} />
          </div>
          <div className="flex gap-3">
            <button className="btn-primary flex-1 justify-center" onClick={saveEdit}>Save Changes</button>
            <button className="btn-outline flex-1 justify-center" onClick={() => setEditModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          title="Delete ITR record?"
          message={`This will permanently delete the ${confirm.itrForm} record for AY ${confirm.assessmentYear}.`}
          onConfirm={() => del(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
