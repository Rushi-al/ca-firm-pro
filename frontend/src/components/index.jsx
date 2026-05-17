// ── Modal ──────────────────────────────────────────────────
export function Modal({ title, onClose, children, maxWidth = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`bg-[#0f172a] border border-slate-700 rounded-2xl p-6 w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-bold text-slate-100">{title}</h2>
          <button className="text-slate-500 hover:text-slate-100 text-xl leading-none px-1" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── ConfirmModal ────────────────────────────────────────────
export function ConfirmModal({ title, message, onConfirm, onCancel, danger = true }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-6 w-full max-w-sm"
        onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-slate-100 mb-2">{title || 'Are you sure?'}</h3>
        <p className="text-sm text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${danger ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-amber-400 hover:bg-amber-300 text-slate-900'}`}>
            Confirm
          </button>
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── StatCard ────────────────────────────────────────────────
const STAT_COLORS = {
  amber:   'text-amber-400',
  emerald: 'text-emerald-400',
  red:     'text-red-400',
  slate:   'text-slate-300',
  purple:  'text-purple-400',
};
export function StatCard({ label, value, sub, color = 'slate', icon }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
        {icon && <span className="text-slate-600">{icon}</span>}
      </div>
      <p className={`text-3xl font-bold ${STAT_COLORS[color]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1.5">{sub}</p>}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────
const STATUS_CLS = {
  'Completed':   'text-emerald-400 bg-emerald-400/10',
  'In Progress': 'text-amber-400   bg-amber-400/10',
  'Not Started': 'text-slate-400   bg-slate-400/10',
  'Overdue':     'text-red-400     bg-red-400/10',
};
const PRI_CLS = {
  High:   'text-red-400   bg-red-400/10',
  Medium: 'text-amber-400 bg-amber-400/10',
  Low:    'text-slate-400 bg-slate-400/10',
};

const isOverdue = t =>
  t.status !== 'Completed' && new Date(t.deadline) < new Date(new Date().toDateString());

export function StatusBadge({ task }) {
  const od    = isOverdue(task);
  const label = od ? 'Overdue' : task.status;
  return <span className={`badge ${STATUS_CLS[label] || STATUS_CLS['Not Started']}`}>{label}</span>;
}

export function PriBadge({ priority }) {
  return <span className={`badge ${PRI_CLS[priority] || PRI_CLS.Low}`}>{priority}</span>;
}

export function RoleBadge({ role }) {
  const cls = role === 'Owner' ? 'text-purple-400 bg-purple-400/10' :
              role === 'Admin' ? 'text-amber-400  bg-amber-400/10'  :
                                 'text-slate-400  bg-slate-400/10';
  return <span className={`badge ${cls}`}>{role}</span>;
}

export function PlanBadge({ plan }) {
  const cls = plan === 'enterprise' ? 'text-purple-400 bg-purple-400/10' :
              plan === 'pro'        ? 'text-amber-400  bg-amber-400/10'  :
                                      'text-slate-400  bg-slate-400/10';
  return <span className={`badge uppercase tracking-wider ${cls}`}>{plan}</span>;
}

// ── Skeleton ─────────────────────────────────────────────────
export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <tr>
      {[1,2,3,4,5].map(i => (
        <td key={i} className="td"><Skeleton className="h-4 w-full" /></td>
      ))}
    </tr>
  );
}

// ── LiveDot ───────────────────────────────────────────────────
export function LiveDot({ lastUpdated }) {
  const ago = lastUpdated ? Math.round((Date.now() - lastUpdated) / 1000) : null;
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />
      <span>Live{ago !== null ? ` · updated ${ago}s ago` : ''}</span>
    </div>
  );
}

// ── Field wrapper with validation UI ─────────────────────────
export function Field({ label, error, touched, children, required }) {
  const showErr = touched && error;
  const showOk  = touched && !error;
  return (
    <div className="mb-3.5">
      {label && (
        <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {showErr && <p className="field-err"><span>✕</span>{error}</p>}
      {showOk  && <p className="field-ok" ><span>✓</span>Looks good</p>}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────
export function EmptyState({ icon, title, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-slate-600">
        {icon || (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
          </svg>
        )}
      </div>
      <p className="text-slate-300 font-semibold mb-1">{title}</p>
      <p className="text-slate-500 text-sm mb-5">{sub}</p>
      {action}
    </div>
  );
}
