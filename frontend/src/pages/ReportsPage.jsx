import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { SkeletonCard } from '../components/index.jsx';

const fmtHrs  = m => `${(m/60).toFixed(1)}h`;
const fmtAmt  = a => a > 0 ? `₹${a.toLocaleString('en-IN')}` : '₹0';
const fmtPct  = p => `${p}%`;

const COLORS = ['#f59e0b','#34d399','#f87171','#60a5fa','#a78bfa','#fb7185'];

const TT_STYLE = {
  contentStyle: { background:'#1e293b', border:'1px solid #334155', borderRadius:8, fontSize:12 },
  itemStyle:    { color:'#cbd5e1' },
  labelStyle:   { color:'#94a3b8' },
};

export default function ReportsPage() {
  const { toast }   = useToast();
  const [tab,       setTab]       = useState('overview');
  const [overview,  setOverview]  = useState(null);
  const [prodData,  setProdData]  = useState([]);
  const [clientData,setClientData]= useState([]);
  const [loading,   setLoading]   = useState(true);
  const [dateRange, setDateRange] = useState({ from:'', to:'' });
  const [exporting, setExporting] = useState(false);

  useEffect(() => { document.title = 'Reports | CA Firm Pro'; }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('from', dateRange.from);
      if (dateRange.to)   params.set('to',   dateRange.to);
      const qs = params.toString();

      const [ov, pr, cl] = await Promise.all([
        api.get(`/reports/overview?${qs}`),
        api.get(`/reports/productivity?${qs}`),
        api.get(`/reports/clients?${qs}`),
      ]);
      setOverview(ov.data.data);
      setProdData(pr.data.data);
      setClientData(cl.data.data);
    } catch (err) {
      toast('Failed to load reports.', 'error');
    } finally { setLoading(false); }
  }, [dateRange, toast]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = async (type) => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ type });
      if (dateRange.from) params.set('from', dateRange.from);
      if (dateRange.to)   params.set('to',   dateRange.to);
      const res  = await api.get(`/reports/export?${params}`, { responseType:'blob' });
      const url  = URL.createObjectURL(res.data);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${type}-report-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`${type} report downloaded.`, 'success');
    } catch {
      toast('Export failed.', 'error');
    } finally { setExporting(false); }
  };

  const TABS = ['overview','productivity','clients'];

  // Pie data
  const pieData = overview ? [
    { name:'Completed',   value: overview.tasks.completed,                                     color:'#34d399' },
    { name:'In Progress', value: overview.tasks.total - overview.tasks.completed - overview.tasks.overdue, color:'#f59e0b' },
    { name:'Overdue',     value: overview.tasks.overdue,                                       color:'#f87171' },
  ].filter(d => d.value > 0) : [];

  // Priority bar data
  const priData = overview ? [
    { name:'High',   count: overview.tasks.byPriority?.High   || 0, fill:'#f87171' },
    { name:'Medium', count: overview.tasks.byPriority?.Medium || 0, fill:'#f59e0b' },
    { name:'Low',    count: overview.tasks.byPriority?.Low    || 0, fill:'#64748b' },
  ] : [];

  // Trend line data
  const trendData = overview?.trend?.map(t => ({
    date:  t._id.slice(5),  // MM-DD
    tasks: t.count,
  })) || [];

  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 mb-0.5">Reports & Analytics</h1>
          <p className="text-sm text-slate-500">Firm-wide performance insights</p>
        </div>

        {/* Date range + export */}
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" className="input w-auto bg-[#0f172a] border-slate-800 text-xs py-2"
            value={dateRange.from} onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))} />
          <span className="text-slate-600 text-xs">to</span>
          <input type="date" className="input w-auto bg-[#0f172a] border-slate-800 text-xs py-2"
            value={dateRange.to} onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))} />
          {(dateRange.from || dateRange.to) && (
            <button className="btn-outline text-xs py-2 px-3" onClick={() => setDateRange({ from:'', to:'' })}>Clear</button>
          )}
          <div className="flex gap-1.5">
            {['tasks','time','clients'].map(type => (
              <button key={type} disabled={exporting}
                className="btn-outline text-xs py-2 px-3 capitalize"
                onClick={() => exportCSV(type)}>
                ↓ {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1 w-fit mb-6 border border-slate-800">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
              tab === t ? 'bg-amber-400 text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────── */}
      {tab === 'overview' && (
        loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : overview && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label:'Total Tasks',       val: overview.tasks.total,          color:'text-slate-300'   },
                { label:'Completion Rate',   val: fmtPct(overview.tasks.completionRate), color:'text-emerald-400' },
                { label:'Billable Hours',    val: fmtHrs(overview.time.billableHours*60), color:'text-amber-400'   },
                { label:'Total Billed',      val: fmtAmt(overview.time.totalBilled),  color:'text-emerald-400'   },
              ].map(s => (
                <div key={s.label} className="card">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>

            {/* Charts row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              {/* Pie: task status */}
              <div className="card">
                <p className="text-sm font-semibold text-slate-300 mb-4">Task Status Distribution</p>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                        paddingAngle={3} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}
                        labelLine={false}>
                        {pieData.map((d,i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip {...TT_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-slate-500 text-sm text-center py-16">No task data</p>}
              </div>

              {/* Bar: tasks by priority */}
              <div className="card">
                <p className="text-sm font-semibold text-slate-300 mb-4">Tasks by Priority</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={priData} barCategoryGap="40%">
                    <XAxis dataKey="name" tick={{ fontSize:12, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:12, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...TT_STYLE} />
                    <Bar dataKey="count" radius={[6,6,0,0]}>
                      {priData.map((d,i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Task completion trend */}
            {trendData.length > 0 && (
              <div className="card mb-5">
                <p className="text-sm font-semibold text-slate-300 mb-4">Task Completion Trend (Last 12 Weeks)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...TT_STYLE} />
                    <Line type="monotone" dataKey="tasks" stroke="#f59e0b" strokeWidth={2.5}
                      dot={{ fill:'#f59e0b', r:4 }} activeDot={{ r:6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Compliance summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label:'GST Filed',   val: overview.compliance.gstFiled,   color:'text-emerald-400' },
                { label:'GST Overdue', val: overview.compliance.gstOverdue,  color:'text-red-400'     },
                { label:'ITR Filed',   val: overview.compliance.itrFiled,    color:'text-emerald-400' },
                { label:'ITR Overdue', val: overview.compliance.itrOverdue,  color:'text-red-400'     },
              ].map(s => (
                <div key={s.label} className="card text-center py-4">
                  <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {/* ── PRODUCTIVITY TAB ─────────────────────────────── */}
      {tab === 'productivity' && (
        loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div> : (
          <>
            {/* Bar chart */}
            <div className="card mb-5">
              <p className="text-sm font-semibold text-slate-300 mb-4">Tasks per Employee</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={prodData.map(e => ({ name: e.name.split(' ')[0], Total: e.tasks.total, Done: e.tasks.done }))} barCategoryGap="35%">
                  <XAxis dataKey="name" tick={{ fontSize:12, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:12, fill:'#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip {...TT_STYLE} />
                  <Legend wrapperStyle={{ fontSize:12, color:'#94a3b8' }} />
                  <Bar dataKey="Total" fill="#f59e0b" radius={[4,4,0,0]} />
                  <Bar dataKey="Done"  fill="#34d399" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead><tr>
                  <th className="th">Employee</th><th className="th">Role</th>
                  <th className="th">Total Tasks</th><th className="th">Completed</th>
                  <th className="th">Overdue</th><th className="th">Rate</th>
                  <th className="th">Hours Logged</th><th className="th">Billed</th>
                </tr></thead>
                <tbody>
                  {prodData.map(e => (
                    <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="td font-semibold text-slate-100">{e.name}</td>
                      <td className="td text-xs text-slate-500 capitalize">{e.role}</td>
                      <td className="td text-slate-300">{e.tasks.total}</td>
                      <td className="td text-emerald-400">{e.tasks.done}</td>
                      <td className="td">
                        <span className={e.tasks.overdue > 0 ? 'text-red-400 font-semibold' : 'text-slate-500'}>{e.tasks.overdue}</span>
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-amber-400" style={{ width:`${e.tasks.rate}%` }} />
                          </div>
                          <span className="text-xs text-slate-400">{e.tasks.rate}%</span>
                        </div>
                      </td>
                      <td className="td text-amber-400">{e.time.hours}h</td>
                      <td className="td text-slate-300">{fmtAmt(e.time.billed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {prodData.length === 0 && <p className="text-center py-10 text-slate-500">No employee data.</p>}
            </div>
          </>
        )
      )}

      {/* ── CLIENTS TAB ──────────────────────────────────── */}
      {tab === 'clients' && (
        loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div> : (
          <>
            {/* Bar chart: hours per client */}
            <div className="card mb-5">
              <p className="text-sm font-semibold text-slate-300 mb-4">Hours per Client (Top 10)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={clientData.slice(0,10).map(c => ({ name: c.name.slice(0,12), hours: c.time.hours, billed: c.time.billed/100 }))} layout="vertical">
                  <XAxis type="number" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip {...TT_STYLE} />
                  <Bar dataKey="hours" fill="#f59e0b" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead><tr>
                  <th className="th">Client</th><th className="th">Total Tasks</th>
                  <th className="th">Completed</th><th className="th">GST Filed</th>
                  <th className="th">ITR Filed</th><th className="th">Hours</th><th className="th">Billed</th>
                </tr></thead>
                <tbody>
                  {clientData.map(c => (
                    <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="td font-semibold text-slate-100">{c.name}</td>
                      <td className="td text-slate-300">{c.tasks.total}</td>
                      <td className="td text-emerald-400">{c.tasks.done}</td>
                      <td className="td text-slate-400">{c.compliance.gstFiled}</td>
                      <td className="td text-slate-400">{c.compliance.itrFiled}</td>
                      <td className="td text-amber-400">{c.time.hours}h</td>
                      <td className="td text-slate-300">{fmtAmt(c.time.billed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {clientData.length === 0 && <p className="text-center py-10 text-slate-500">No client data.</p>}
            </div>
          </>
        )
      )}
    </>
  );
}
