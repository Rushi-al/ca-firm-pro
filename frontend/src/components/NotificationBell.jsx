import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const BellIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const TYPE_ICONS = {
  task_assigned:  '📋',
  task_overdue:   '⚠️',
  task_completed: '✅',
  task_updated:   '✏️',
  gst_deadline:   '🧾',
  itr_deadline:   '📊',
  time_approved:  '✓',
  time_rejected:  '✕',
  plan_expiring:  '💳',
  weekly_summary: '📧',
  portal_activity:'👤',
  general:        '🔔',
};

const relTime = d => {
  const s = Math.round((Date.now() - new Date(d)) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400)return `${Math.floor(s/3600)}h ago`;
  return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open,    setOpen]    = useState(false);
  const [notifs,  setNotifs]  = useState([]);
  const [count,   setCount]   = useState(0);
  const [loading, setLoading] = useState(false);
  const dropRef = useRef(null);

  // Poll unread count every 30s
  const fetchCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/count');
      setCount(res.data.data.count);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 30000);
    return () => clearInterval(id);
  }, [fetchCount]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openPanel = async () => {
    setOpen(o => !o);
    if (!open) {
      setLoading(true);
      try {
        const res = await api.get('/notifications?limit=25');
        setNotifs(res.data.data.notifications);
        setCount(res.data.data.unreadCount);
      } finally { setLoading(false); }
    }
  };

  const markRead = async (notif) => {
    if (!notif.isRead) {
      await api.put(`/notifications/${notif._id}/read`).catch(() => {});
      setNotifs(n => n.map(x => x._id === notif._id ? { ...x, isRead: true } : x));
      setCount(c => Math.max(0, c - 1));
    }
    if (notif.link) { navigate(notif.link); setOpen(false); }
  };

  const markAllRead = async () => {
    await api.put('/notifications/read-all').catch(() => {});
    setNotifs(n => n.map(x => ({ ...x, isRead: true })));
    setCount(0);
  };

  const remove = async (e, id) => {
    e.stopPropagation();
    await api.delete(`/notifications/${id}`).catch(() => {});
    setNotifs(n => n.filter(x => x._id !== id));
  };

  return (
    <div className="relative" ref={dropRef}>
      {/* Bell button */}
      <button
        onClick={openPanel}
        className="relative p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors">
        <BellIcon />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full
            flex items-center justify-center text-white text-xs font-bold px-1 leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100">Notifications</h3>
            {count > 0 && (
              <button onClick={markAllRead} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-slate-500 text-sm">Loading…</div>
            ) : notifs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-slate-500 text-sm">No notifications yet</p>
              </div>
            ) : (
              notifs.map(n => (
                <div key={n._id}
                  onClick={() => markRead(n)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-slate-800/50 cursor-pointer
                    transition-colors hover:bg-slate-800/50 ${!n.isRead ? 'bg-amber-400/[0.03]' : ''}`}>
                  {/* Icon */}
                  <span className="text-lg flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold leading-tight ${!n.isRead ? 'text-slate-100' : 'text-slate-300'}`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-xs text-slate-600 mt-1">{relTime(n.createdAt)}</p>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => remove(e, n._id)}
                    className="flex-shrink-0 text-slate-600 hover:text-red-400 text-sm leading-none p-1 transition-colors">
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-800 text-center">
              <p className="text-xs text-slate-600">Showing {notifs.length} notifications</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
