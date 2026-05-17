import { useState } from 'react';

// This component is used inside ClientPortalApp.jsx
// to show sign-off requests from the CA firm

const STATUS_CLS = {
  pending:  'text-amber-400 bg-amber-400/10',
  approved: 'text-emerald-400 bg-emerald-400/10',
  rejected: 'text-red-400 bg-red-400/10',
};

export function SignOffPanel({ tasks, onSignOff }) {
  const [comment,  setComment]  = useState('');
  const [actionId, setActionId] = useState(null); // taskId being actioned
  const [loading,  setLoading]  = useState(false);

  const pending = tasks.filter(t => t.signOff?.status === 'pending');
  const done    = tasks.filter(t => t.signOff?.status && t.signOff.status !== 'pending');

  const handleAction = async (taskId, action) => {
    setLoading(true);
    try {
      await onSignOff(taskId, action, comment);
      setComment('');
      setActionId(null);
    } finally {
      setLoading(false);
    }
  };

  if (pending.length === 0 && done.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      {/* Pending sign-offs */}
      {pending.length > 0 && (
        <div style={{ background:'rgba(245,158,11,.05)', border:'1px solid rgba(245,158,11,.2)', borderRadius:12, padding:20, marginBottom:16 }}>
          <p style={{ color:'#f59e0b', fontSize:13, fontWeight:700, marginBottom:14 }}>
            ✍️ {pending.length} Task{pending.length>1?'s':''} Awaiting Your Approval
          </p>

          {pending.map(t => (
            <div key={t._id} style={{ background:'#1e293b', borderRadius:10, padding:16, marginBottom:12 }}>
              <p style={{ fontSize:14, fontWeight:600, color:'#f1f5f9', marginBottom:6 }}>{t.title}</p>
              <p style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
                Requested: {new Date(t.signOff.requestedAt).toLocaleDateString('en-IN')}
              </p>

              {actionId === t._id ? (
                <div>
                  <textarea
                    style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:8, padding:'8px 12px', color:'#f1f5f9', fontSize:12, width:'100%', outline:'none', fontFamily:'inherit', marginBottom:10, resize:'vertical' }}
                    rows={2}
                    placeholder="Add a comment (optional)…"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                  />
                  <div style={{ display:'flex', gap:8 }}>
                    <button
                      disabled={loading}
                      onClick={() => handleAction(t._id, 'approve')}
                      style={{ flex:1, background:'#34d399', color:'#020817', border:'none', borderRadius:8, padding:'9px 0', fontSize:13, fontWeight:700, cursor:'pointer', opacity: loading?0.6:1 }}>
                      ✓ Approve
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => handleAction(t._id, 'reject')}
                      style={{ flex:1, background:'rgba(248,113,113,.1)', color:'#f87171', border:'1px solid rgba(248,113,113,.3)', borderRadius:8, padding:'9px 0', fontSize:13, fontWeight:700, cursor:'pointer', opacity:loading?0.6:1 }}>
                      ✕ Reject
                    </button>
                    <button
                      onClick={() => { setActionId(null); setComment(''); }}
                      style={{ background:'#334155', color:'#94a3b8', border:'none', borderRadius:8, padding:'9px 14px', fontSize:13, cursor:'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setActionId(t._id)}
                  style={{ background:'#f59e0b', color:'#020817', border:'none', borderRadius:8, padding:'8px 20px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  Review & Sign Off →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completed sign-offs */}
      {done.length > 0 && (
        <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:12, padding:20 }}>
          <p style={{ color:'#64748b', fontSize:12, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>Past Sign-Offs</p>
          {done.map(t => (
            <div key={t._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #1e293b' }}>
              <div>
                <p style={{ fontSize:13, color:'#e2e8f0', fontWeight:500 }}>{t.title}</p>
                {t.signOff?.comment && <p style={{ fontSize:11, color:'#64748b', marginTop:2 }}>"{t.signOff.comment}"</p>}
              </div>
              <span style={{
                padding:'3px 10px', borderRadius:6, fontSize:11, fontWeight:600,
                color: t.signOff?.status==='approved' ? '#34d399' : '#f87171',
                background: t.signOff?.status==='approved' ? 'rgba(52,211,153,.1)' : 'rgba(248,113,113,.1)',
              }}>
                {t.signOff?.status === 'approved' ? '✓ Approved' : '✕ Rejected'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
