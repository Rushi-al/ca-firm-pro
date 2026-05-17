// ── CHANGES TO MAKE IN Layout.jsx ─────────────────────────
// 
// 1. Import NotificationBell at the top:
//    import NotificationBell from './NotificationBell';
//
// 2. Add /security route to adminLinks:
//    { to: '/security', label: 'Security (2FA)', icon: Ic.lock }
//
// 3. Add the bell inside the sidebar footer, next to the user avatar:
//
// BEFORE (in the footer section):
//   <div className="flex items-center gap-2.5 mb-2">
//     <div className="w-7 h-7 rounded-full ...">
//       {initials(user?.name)}
//     </div>
//     ...
//   </div>
//
// AFTER:
//   <div className="flex items-center gap-2 mb-2">
//     <div className="w-7 h-7 rounded-full ...">
//       {initials(user?.name)}
//     </div>
//     <div className="flex-1 min-w-0">
//       <div className="text-xs font-semibold text-slate-200 truncate">{user?.name}</div>
//       <div className="text-xs text-slate-600 truncate">{user?.email}</div>
//     </div>
//     <NotificationBell />   ← ADD THIS
//   </div>
//
// 4. Add lock icon to Ic object:
//    lock: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
//
// ─────────────────────────────────────────────────────────
// The full updated adminLinks section (replace in Layout.jsx):
// ─────────────────────────────────────────────────────────
export const ADMIN_LINKS_V3 = [
  { label:'CORE' },
  { to:'/dashboard',  label:'Dashboard',    icon:'dash'   },
  { to:'/clients',    label:'Clients',       icon:'cli'    },
  { to:'/tasks',      label:'Tasks',         icon:'task'   },
  { to:'/employees',  label:'Employees',     icon:'emp'    },
  { to:'/time',       label:'Time Tracking', icon:'time'   },
  { label:'CA TOOLS' },
  { to:'/gst',        label:'GST Calendar',  icon:'gst'    },
  { to:'/itr',        label:'Income Tax',    icon:'itr'    },
  { to:'/recurring',  label:'Recurring',     icon:'rec'    },
  { to:'/portal',     label:'Client Portal', icon:'portal' },
  { label:'INSIGHTS' },
  { to:'/reports',    label:'Reports',       icon:'rep'    },
  { to:'/activity',   label:'Activity',      icon:'act'    },
  { to:'/ai',         label:'AI Insights',   icon:'ai'     },
  { label:'ACCOUNT' },
  { to:'/security',   label:'Security (2FA)',icon:'lock'   },
  { to:'/pricing',    label:'Upgrade Plan',  icon:'star'   },
  { to:'/billing',    label:'Billing',       icon:'bill'   },
];

export const EMP_LINKS_V3 = [
  { to:'/dashboard', label:'My Tasks',     icon:'task' },
  { to:'/time',      label:'Time Tracker', icon:'time' },
  { to:'/security',  label:'Security',     icon:'lock' },
  { to:'/ai',        label:'AI Assistant', icon:'ai'   },
];
