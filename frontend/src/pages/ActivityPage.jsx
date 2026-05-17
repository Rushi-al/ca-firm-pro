import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { LiveDot, EmptyState } from '../components/index.jsx';

const relTime = d => {
  const s = Math.round((Date.now() - new Date(d)) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
};

const initials = n => n?.split(' ').map(x=>x[0]).join('').toUpperCase() || '?';

const roleColor = r =>
  r === 'Owner' ? 'bg-purple-400/10 text-purple-400' :
  r === 'Admin' ? 'bg-amber-400/10  text-amber-400'  :
                  'bg-slate-800     text-slate-400';

export default function ActivityPage() {
  const [logs,        setLogs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => { document.title = 'Activity | CA Firm Pro'; }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/activities?limit=20');
      setLogs(res.data.data);
      setLastUpdated(Date.now());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100 mb-0.5">Activity Log</h1>
          <p className="text-sm text-slate-500">All actions across your firm</p>
        </div>
        <LiveDot lastUpdated={lastUpdated} />
      </div>

      <div className="card">
        {loading ? (
          <div className="space-y-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-start gap-3">
                <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-3/4" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState title="No activity yet" sub="Actions like task updates and client changes will appear here." />
        ) : (
          <div className="space-y-0">
            {logs.map((log, i) => (
              <div key={log._id} className={`flex items-start gap-3.5 py-4 ${i < logs.length-1 ? 'border-b border-slate-800/60' : ''}`}>
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${roleColor(log.userId?.role)}`}>
                  {initials(log.userId?.name)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <p className="text-sm text-slate-200">
                      <span className="font-semibold">{log.userId?.name || 'Unknown'}</span>
                      {' '}
                      <span className="text-slate-400">{log.action}</span>
                    </p>
                    <span className="text-xs text-slate-600 whitespace-nowrap flex-shrink-0">
                      {relTime(log.createdAt)}
                    </span>
                  </div>
                  {/* Extra context */}
                  {(log.taskId || log.clientId) && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {log.taskId   && <span className="text-amber-400/70">📋 {log.taskId.title}</span>}
                      {log.clientId && <span className="text-slate-500"> · 🏢 {log.clientId.name}</span>}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
