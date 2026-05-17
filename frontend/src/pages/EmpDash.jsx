import { useState, useEffect, useRef, useCallback } from 'react';
import { useEffect as useDocTitle } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { StatCard, StatusBadge, PriBadge, SkeletonCard, LiveDot, EmptyState } from '../components/index.jsx';

const fmtDate   = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const isOverdue = t => t.status !== 'Completed' && new Date(t.deadline) < new Date(new Date().toDateString());
const POLL_MS   = 20000;

const WarnIcon = () => (
  <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

export default function EmpDash() {
  const { toast }  = useToast();
  const [tasks,       setTasks]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const prevRef = useRef(null);

  useEffect(() => { document.title = 'My Tasks | CA Firm Pro'; }, []);

  const load = useCallback(async (isPolling = false) => {
    try {
      const res    = await api.get('/tasks?limit=100');
      const tasks  = [...res.data.data.tasks].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
      const sigStr = JSON.stringify(tasks.map(t => ({ id: t._id, p: t.progress, s: t.status })));

      if (isPolling && prevRef.current && prevRef.current !== sigStr) {
        toast('Your task list has been updated.', 'info');
      }
      prevRef.current = sigStr;
      setTasks(tasks);
      setLastUpdated(Date.now());
    } catch {
      if (isPolling) toast('Could not refresh tasks.', 'warning');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const overdue = tasks.filter(isOverdue).length;

  if (loading) return (
    <div className="grid grid-cols-3 gap-4 mb-7">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
  );

  return (
    <>
      <div className="flex justify-between items-start mb-7">
        <div>
          <h1 className="text-xl font-bold text-slate-100 mb-0.5">My Tasks</h1>
          <p className="text-sm text-slate-500">Sorted by nearest deadline</p>
        </div>
        <LiveDot lastUpdated={lastUpdated} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-7">
        <StatCard label="Total"      value={tasks.length}                                    color="slate"   />
        <StatCard label="In Progress" value={tasks.filter(t => t.status === 'In Progress').length} color="amber"   />
        <StatCard label="Overdue"     value={overdue} color={overdue > 0 ? 'red' : 'emerald'} />
      </div>

      {tasks.length === 0
        ? <EmptyState title="No tasks assigned" sub="Your manager hasn't assigned any tasks yet." />
        : tasks.map(t => {
            const od = isOverdue(t);
            return (
              <div key={t._id} className={`card mb-3 transition-colors ${od ? 'border-red-500/30 bg-red-500/[0.03]' : ''}`}>
                <div className="flex justify-between items-start gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {od && <WarnIcon />}
                      <span className="text-sm font-semibold text-slate-100 truncate">{t.title}</span>
                    </div>
                    <p className="text-xs text-slate-500">{t.clientId?.name}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <PriBadge priority={t.priority} />
                    <StatusBadge task={t} />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                      <span>Progress</span><span>{t.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${t.progress}%`, background: od ? '#ef4444' : '#f59e0b' }} />
                    </div>
                  </div>
                  <span className={`text-xs whitespace-nowrap flex-shrink-0 ${od ? 'text-red-400' : 'text-slate-500'}`}>
                    Due {fmtDate(t.deadline)}
                  </span>
                </div>
              </div>
            );
          })}
    </>
  );
}
