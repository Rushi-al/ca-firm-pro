import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

const initials = n => n?.split(' ').map(x => x[0]).join('').toUpperCase() || '?';

const Ic = {
  dash:   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  cli:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  task:   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  emp:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  act:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  ai:     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  gst:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  rec:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  portal: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  time:   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  itr:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  rep:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6"  y1="20" x2="6"  y2="14"/></svg>,
  star:   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  bill:   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  set:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  out:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  menu:   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
};

const PLAN_COLORS = {
  free:       'text-slate-400 bg-slate-800',
  pro:        'text-amber-400 bg-amber-400/10',
  enterprise: 'text-purple-400 bg-purple-400/10',
};

export default function Layout() {
  const { user, firm, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname]);

  const isAdmin = ['Owner','Admin'].includes(user?.role);
  const isOwner = user?.role === 'Owner';

  const adminLinks = [
    { label:'CORE' },
    { to:'/dashboard',  label:'Dashboard',    icon:Ic.dash   },
    { to:'/clients',    label:'Clients',       icon:Ic.cli    },
    { to:'/tasks',      label:'Tasks',         icon:Ic.task   },
    { to:'/employees',  label:'Employees',     icon:Ic.emp    },
    { label:'CA TOOLS' },
    { to:'/gst',        label:'GST Calendar',  icon:Ic.gst    },
    { to:'/tds-calendar', label:'TDS Calendar',  icon:Ic.rec    },
    { to:'/itr',        label:'Income Tax',    icon:Ic.itr    },
    { to:'/recurring',  label:'Recurring',     icon:Ic.rec    },
    { to:'/portal',     label:'Client Portal', icon:Ic.portal },
    { label:'INSIGHTS' },
    { to:'/reports',    label:'Reports',       icon:Ic.rep    },
    { to:'/activity',   label:'Activity',      icon:Ic.act    },
    { to:'/ai',         label:'AI Insights',   icon:Ic.ai     },
    { label:'ACCOUNT' },
    { to:'/pricing',    label:'Upgrade Plan',  icon:Ic.star   },
    { to:'/billing',    label:'Billing',       icon:Ic.bill   },
  ];

  const empLinks = [
    { to:'/dashboard', label:'My Tasks',     icon:Ic.task },
    { to:'/ai',        label:'AI Assistant', icon:Ic.ai   },
  ];

  const links = isAdmin ? adminLinks : empLinks;

  const Sidebar = () => (
    <aside className="w-56 bg-[#0f172a] border-r border-slate-800 flex flex-col h-full">
      {/* Logo + firm */}
      <div className="px-4 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-amber-400/10 rounded-lg flex items-center justify-center text-amber-400 text-xs font-black flex-shrink-0">CA</div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-100 truncate">{firm?.name || 'CA Firm Pro'}</div>
            <div className="text-xs text-slate-500">{user?.role}</div>
          </div>
        </div>
        {firm?.plan && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${PLAN_COLORS[firm.plan]}`}>
            {firm.plan}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {links.map((l, i) => {
          if (!l.to) return (
            <p key={i} className="px-3 pt-4 pb-1 text-xs text-slate-700 uppercase tracking-widest font-bold">
              {l.label}
            </p>
          );
          return (
            <NavLink key={l.to} to={l.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              {l.icon}
              <span className="text-xs">{l.label}</span>
            </NavLink>
          );
        })}
        {isOwner && (
          <NavLink to="/settings" className={({ isActive }) => `nav-link${isActive ? ' active' : ''} mt-1`}>
            {Ic.set} <span className="text-xs">Firm Settings</span>
          </NavLink>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-7 h-7 rounded-full bg-amber-400/10 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">
            {initials(user?.name)}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-200 truncate">{user?.name}</div>
            <div className="text-xs text-slate-600 truncate">{user?.email}</div>
          </div>
        </div>
        <button className="nav-link text-slate-500 hover:text-red-400 w-full text-xs"
          onClick={() => { logout(); navigate('/login'); }}>
          {Ic.out} Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-56 md:flex-shrink-0 md:fixed md:inset-y-0 z-10">
        <Sidebar />
      </div>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 bg-[#0f172a] border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-amber-400/10 rounded-lg flex items-center justify-center text-amber-400 text-xs font-black">CA</div>
          <span className="text-sm font-bold text-slate-100 truncate max-w-[160px]">{firm?.name || 'CA Firm Pro'}</span>
        </div>
        <button className="text-slate-400 hover:text-slate-100 p-1" onClick={() => setOpen(true)}>{Ic.menu}</button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-56 flex flex-col h-full z-10"><Sidebar /></div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-56 p-5 md:p-8 pt-16 md:pt-8 min-h-screen bg-[#020817]">
        <Outlet />
      </main>
    </div>
  );
}
