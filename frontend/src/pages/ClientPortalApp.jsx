import { useState, useEffect, createContext, useContext } from 'react';

// ── Client Portal Context ─────────────────────────────────
const PortalContext = createContext(null);
const usePortal = () => useContext(PortalContext);

function PortalProvider({ children }) {
  const [portalUser, setPortalUser] = useState(null);
  const [client,     setClient]     = useState(null);
  const [perms,      setPerms]      = useState(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('portal_token');
    const saved = localStorage.getItem('portal_user');
    if (token && saved) {
      try {
        const { portalUser, client, permissions } = JSON.parse(saved);
        setPortalUser(portalUser);
        setClient(client);
        setPerms(permissions);
      } catch { localStorage.removeItem('portal_token'); }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await fetch('/api/portal/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    localStorage.setItem('portal_token', data.data.token);
    localStorage.setItem('portal_user', JSON.stringify(data.data));
    setPortalUser(data.data.portalUser);
    setClient(data.data.client);
    setPerms(data.data.permissions);
    return data.data;
  };

  const logout = () => {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_user');
    setPortalUser(null); setClient(null); setPerms(null);
  };

  return (
    <PortalContext.Provider value={{ portalUser, client, perms, loading, login, logout }}>
      {children}
    </PortalContext.Provider>
  );
}

// ── Fetch helper with portal token ────────────────────────
const portalFetch = async (path) => {
  const token = localStorage.getItem('portal_token');
  const res   = await fetch(`/api/portal${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  return data.data;
};

// ── Status helpers ────────────────────────────────────────
const isOverdue = t => t.status !== 'Completed' && new Date(t.deadline) < new Date();
const fmtDate   = d => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

const STATUS_CLS = {
  'Completed':   'text-emerald-400 bg-emerald-400/10',
  'In Progress': 'text-amber-400   bg-amber-400/10',
  'Not Started': 'text-slate-400   bg-slate-400/10',
  'Overdue':     'text-red-400     bg-red-400/10',
};
const FILING_CLS = {
  filed:       'text-emerald-400 bg-emerald-400/10',
  pending:     'text-amber-400   bg-amber-400/10',
  overdue:     'text-red-400     bg-red-400/10',
  in_progress: 'text-blue-400   bg-blue-400/10',
};

// ── Portal Login Page ─────────────────────────────────────
function PortalLogin() {
  const { login }  = usePortal();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return setError('Please enter email and password.');
    setLoading(true); setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#020817', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:20, padding:36, width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:52, height:52, background:'rgba(245,158,11,.1)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:20, fontWeight:900, color:'#f59e0b' }}>CA</div>
          <h1 style={{ color:'#f1f5f9', fontSize:22, fontWeight:800, margin:0 }}>Client Portal</h1>
          <p style={{ color:'#64748b', fontSize:13, marginTop:6 }}>Track your work status & documents</p>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Email</label>
          <input
            style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:'10px 14px', color:'#f1f5f9', fontSize:13, width:'100%', outline:'none', boxSizing:'border-box' }}
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="your@email.com"
          />
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Password</label>
          <input
            style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:'10px 14px', color:'#f1f5f9', fontSize:13, width:'100%', outline:'none', boxSizing:'border-box' }}
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
          />
        </div>

        {error && <p style={{ color:'#f87171', fontSize:12, background:'rgba(248,113,113,.08)', padding:'8px 12px', borderRadius:6, marginBottom:12 }}>{error}</p>}

        <button
          onClick={handleLogin} disabled={loading}
          style={{ width:'100%', background:'#f59e0b', color:'#020817', border:'none', borderRadius:8, padding:'12px 0', fontSize:14, fontWeight:700, cursor:'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Signing in…' : 'Sign In →'}
        </button>

        <p style={{ textAlign:'center', color:'#475569', fontSize:12, marginTop:20 }}>
          Your login was provided by your CA firm. Contact them if you need assistance.
        </p>
      </div>
    </div>
  );
}

// ── Portal Dashboard ──────────────────────────────────────
function PortalDashboard() {
  const { client, perms, logout } = usePortal();
  const [tab,     setTab]     = useState('tasks');
  const [tasks,   setTasks]   = useState([]);
  const [filings, setFilings] = useState([]);
  const [docs,    setDocs]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loads = [];
    if (perms?.canViewTasks)     loads.push(portalFetch('/tasks').then(setTasks));
    if (perms?.canViewDocuments) loads.push(portalFetch('/documents').then(setDocs));
    loads.push(portalFetch('/gst').then(setFilings));
    Promise.all(loads).finally(() => setLoading(false));
  }, [perms]);

  const S = (style) => ({ ...style }); // style helper

  const Card = ({ children, style = {} }) => (
    <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:12, padding:20, ...style }}>
      {children}
    </div>
  );

  const Badge = ({ label, cls }) => (
    <span style={{
      display:'inline-flex', padding:'3px 8px', borderRadius:6,
      fontSize:11, fontWeight:600,
      color: cls?.includes('emerald') ? '#34d399' : cls?.includes('amber') ? '#fbbf24' : cls?.includes('red') ? '#f87171' : cls?.includes('blue') ? '#60a5fa' : '#94a3b8',
      background: cls?.includes('emerald') ? 'rgba(52,211,153,.1)' : cls?.includes('amber') ? 'rgba(251,191,36,.1)' : cls?.includes('red') ? 'rgba(248,113,113,.1)' : cls?.includes('blue') ? 'rgba(96,165,250,.1)' : 'rgba(148,163,184,.1)',
    }}>
      {label}
    </span>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#020817', fontFamily:'system-ui,sans-serif', color:'#f1f5f9' }}>
      {/* Header */}
      <div style={{ background:'#0f172a', borderBottom:'1px solid #1e293b', padding:'16px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, background:'rgba(245,158,11,.1)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#f59e0b', fontSize:12 }}>CA</div>
          <div>
            <p style={{ fontSize:14, fontWeight:700, margin:0 }}>{client?.name}</p>
            <p style={{ fontSize:11, color:'#64748b', margin:0 }}>Client Portal</p>
          </div>
        </div>
        <button onClick={logout} style={{ background:'transparent', border:'1px solid #334155', color:'#94a3b8', borderRadius:8, padding:'6px 14px', fontSize:12, cursor:'pointer' }}>
          Sign Out
        </button>
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'28px 20px' }}>
        {/* Tabs */}
        <div style={{ display:'flex', gap:4, background:'#0f172a', borderRadius:12, padding:4, marginBottom:24, border:'1px solid #1e293b', width:'fit-content' }}>
          {[
            perms?.canViewTasks     && { id:'tasks',    label:`Tasks (${tasks.length})`         },
            { id:'gst',             label:`GST Filings (${filings.length})`                      },
            perms?.canViewDocuments && { id:'documents', label:`Documents (${docs.length})`      },
          ].filter(Boolean).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding:'8px 18px', borderRadius:8, border:'none', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all .15s',
                background: tab === t.id ? '#f59e0b' : 'transparent',
                color:      tab === t.id ? '#020817' : '#94a3b8' }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:'#475569' }}>Loading your data…</div>
        ) : (
          <>
            {/* Tasks tab */}
            {tab === 'tasks' && (
              <div>
                {tasks.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'60px 0', color:'#475569' }}>No tasks found.</div>
                ) : tasks.map(t => {
                  const od    = isOverdue(t);
                  const label = od ? 'Overdue' : t.status;
                  return (
                    <Card key={t._id} style={{ marginBottom:12, borderColor: od ? 'rgba(239,68,68,.3)' : '#1e293b' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:12 }}>
                        <div>
                          <p style={{ fontSize:14, fontWeight:600, margin:'0 0 4px' }}>{t.title}</p>
                          {t.notes && <p style={{ fontSize:12, color:'#64748b', margin:0 }}>{t.notes}</p>}
                        </div>
                        <Badge label={label} cls={STATUS_CLS[label]} />
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#64748b', marginBottom:5 }}>
                            <span>Progress</span><span>{t.progress}%</span>
                          </div>
                          <div style={{ height:5, background:'#1e293b', borderRadius:10, overflow:'hidden' }}>
                            <div style={{ height:'100%', borderRadius:10, background: od ? '#ef4444' : '#f59e0b', width:`${t.progress}%` }} />
                          </div>
                        </div>
                        <span style={{ fontSize:11, color: od ? '#f87171' : '#64748b', whiteSpace:'nowrap' }}>Due {fmtDate(t.deadline)}</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* GST tab */}
            {tab === 'gst' && (
              <Card>
                {filings.length === 0 ? (
                  <p style={{ color:'#475569', textAlign:'center', padding:'40px 0' }}>No GST filings found.</p>
                ) : (
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr>
                        {['Return Type','Period','Due Date','Filed On','Status'].map(h => (
                          <th key={h} style={{ textAlign:'left', color:'#475569', fontSize:11, textTransform:'uppercase', padding:'8px 12px', borderBottom:'1px solid #1e293b' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filings.map(f => (
                        <tr key={f._id}>
                          <td style={{ padding:'12px', fontFamily:'monospace', color:'#f59e0b', fontWeight:600 }}>{f.returnType}</td>
                          <td style={{ padding:'12px', color:'#94a3b8' }}>{f.period?.month ? `M${f.period.month}` : ''} {f.period?.year}</td>
                          <td style={{ padding:'12px', color:'#64748b', fontSize:12 }}>{fmtDate(f.dueDate)}</td>
                          <td style={{ padding:'12px', color:'#64748b', fontSize:12 }}>{f.filedDate ? fmtDate(f.filedDate) : '—'}</td>
                          <td style={{ padding:'12px' }}><Badge label={f.status} cls={FILING_CLS[f.status]} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            )}

            {/* Documents tab */}
            {tab === 'documents' && (
              <div>
                {docs.length === 0 ? (
                  <Card><p style={{ color:'#475569', textAlign:'center', padding:'40px 0' }}>No documents available.</p></Card>
                ) : docs.map(d => (
                  <Card key={d.id} style={{ marginBottom:10, display:'flex', alignItems:'center', gap:14 }}>
                    <span style={{ fontSize:24 }}>📄</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:600, margin:'0 0 3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</p>
                      <p style={{ fontSize:11, color:'#64748b', margin:0 }}>{d.taskTitle} · {fmtDate(d.uploadedAt)}</p>
                    </div>
                    {d.downloadUrl && (
                      <a href={d.downloadUrl} target="_blank" rel="noreferrer"
                        style={{ background:'#f59e0b', color:'#020817', borderRadius:8, padding:'7px 16px', textDecoration:'none', fontSize:12, fontWeight:700, flexShrink:0 }}>
                        Download
                      </a>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────
export default function ClientPortalApp() {
  return (
    <PortalProvider>
      <PortalInner />
    </PortalProvider>
  );
}

function PortalInner() {
  const { portalUser, loading } = usePortal();
  if (loading) return <div style={{ minHeight:'100vh', background:'#020817', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569' }}>Loading…</div>;
  return portalUser ? <PortalDashboard /> : <PortalLogin />;
}
