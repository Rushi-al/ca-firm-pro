import { useState, useEffect, useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { StatCard, StatusBadge, PriBadge, SkeletonCard, SkeletonRow, LiveDot, EmptyState } from '../components/index.jsx';

const fmtDate   = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const isOverdue = t => t.status !== 'Completed' && new Date(t.deadline) < new Date(new Date().toDateString());
const POLL_MS   = 20000;

export default function AdminDash() {
  const { user }  = useAuth();
  const { toast } = useToast();
  const [stats,       setStats]       = useState(null);
  const [tasks,       setTasks]       = useState([]);
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const prevRef = useRef(null);

  useEffect(() => { document.title = 'Dashboard | CA Firm Pro'; }, []);

  const load = useCallback(async (isPolling = false) => {
    try {
      const [s, t, u] = await Promise.all([
        api.get('/tasks/stats'),
        api.get('/tasks?limit=100'),
        api.get('/users'),
      ]);
      const newStats = s.data.data;
      const newTasks = t.data.data.tasks;
      const newUsers = u.data.data;

      // Detect changes for toast notification
      if (isPolling && prevRef.current) {
        const prev = JSON.stringify(prevRef.current);
        const next = JSON.stringify({ stats: newStats, count: newTasks.length });
        if (prev !== next) toast('Dashboard data updated.', 'info');
      }
      prevRef.current = { stats: newStats, count: newTasks.length };

      setStats(newStats);
      setTasks(newTasks);
      setUsers(newUsers);
      setLastUpdated(Date.now());
    } catch {
      if (isPolling) toast('Could not refresh data.', 'warning');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Chart data
  const pieData = stats ? [
    { name: 'Completed',   value: stats.completed,  color: '#34d399' },
    { name: 'In Progress', value: stats.inProgress, color: '#f59e0b' },
    { name: 'Not Started', value: stats.notStarted, color: '#475569' },
    { name: 'Overdue',     value: stats.overdue,    color: '#f87171' },
  ].filter(d => d.value > 0) : [];

  const barData = users.map(u => ({
    name:  u.name.split(' ')[0],
    Total: tasks.filter(t => t.assignedTo?._id === u._id || t.assignedTo === u._id).length,
    Done:  tasks.filter(t => (t.assignedTo?._id === u._id || t.assignedTo === u._id) && t.status === 'Completed').length,
  }));

  const urgent = tasks.filter(t => isOverdue(t) || t.priority === 'High').slice(0, 6);

  if (loading) return (
    <>
      <div className="flex justify-between items-center mb-7">
        <div className="skeleton h-7 w-48" />
        <div className="skeleton h-4 w-24" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
      </div>
    </>
  );

  return (
    <>
      <div className="flex flex-wrap justify-between items-start gap-3 mb-7">
        <div>
          <h1 className="text-xl font-bold text-slate-100 mb-0.5">Dashboard</h1>
          <p className="text-sm text-slate-500">Welcome back, {user?.name?.split(' ')[0]} 👋</p>
        </div>
        <LiveDot lastUpdated={lastUpdated} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        <StatCard label="Total Tasks"  value={stats?.total}      color="slate"   />
        <StatCard label="Completed"    value={stats?.completed}  color="emerald" sub={`${stats?.total ? Math.round(stats.completed/stats.total*100) : 0}% done`} />
        <StatCard label="In Progress"  value={stats?.inProgress} color="amber"   />
        <StatCard label="Overdue"      value={stats?.overdue}    color={stats?.overdue > 0 ? 'red' : 'emerald'} sub={stats?.overdue > 0 ? 'Needs attention' : 'All on track'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <div className="card">
          <p className="text-sm font-semibold text-slate-300 mb-4">Task Distribution</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No tasks yet" sub="Create your first task to see charts." />}
        </div>

        <div className="card">
          <p className="text-sm font-semibold text-slate-300 mb-4">Workload by Employee</p>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barCategoryGap="35%">
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Bar dataKey="Total" fill="#f59e0b" radius={[4,4,0,0]} />
                <Bar dataKey="Done"  fill="#34d399" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No employees yet" sub="Add employees to see workload chart." />}
        </div>
      </div>

      {/* Urgent tasks */}
      <div className="card">
        <p className="text-sm font-semibold text-slate-300 mb-4">Overdue & High Priority</p>
        {urgent.length === 0
          ? <EmptyState title="All clear!" sub="No overdue or high-priority tasks. Great work 🎉" />
          : urgent.map(t => {
              const od = isOverdue(t);
              return (
                <div key={t._id} className="flex items-center gap-3 py-3 border-b border-slate-800/60 last:border-0 flex-wrap">
                  <StatusBadge task={t} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 font-medium truncate">{t.title}</p>
                    <p className="text-xs text-slate-500">{t.clientId?.name} · {t.assignedTo?.name?.split(' ')[0]}</p>
                  </div>
                  <PriBadge priority={t.priority} />
                  <span className={`text-xs whitespace-nowrap ${od ? 'text-red-400' : 'text-slate-500'}`}>
                    {fmtDate(t.deadline)}
                  </span>
                </div>
              );
            })}
      </div>
    </>
  );
}
