import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const SendIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const AiIcon  = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>;

const isOverdue = t => t.status !== 'Completed' && new Date(t.deadline) < new Date(new Date().toDateString());

export default function AIPage() {
  const { user, firm } = useAuth();
  const [tasks,   setTasks]   = useState([]);
  const [clients, setClients] = useState([]);
  const [users,   setUsers]   = useState([]);
  const [msgs,    setMsgs]    = useState([{
    role: 'assistant',
    content: `Hello! I'm your CA Firm AI assistant with live access to your firm's data.\n\nI can help you with:\n• Overdue task analysis & prioritization\n• Employee workload distribution\n• Deadline tracking & upcoming due dates\n• Client task summaries\n• Recommendations for what to focus on\n\nTry a quick prompt below or ask me anything!`,
  }]);
  const [inp,     setInp]     = useState('');
  const [loading, setLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const ref = useRef(null);

  useEffect(() => { document.title = 'AI Insights | CA Firm Pro'; }, []);

  useEffect(() => {
    const isAdmin = ['Owner', 'Admin'].includes(user?.role);
    const reqs = [api.get('/tasks?limit=200')];
    if (isAdmin) {
      reqs.push(api.get('/clients?limit=100'));
      reqs.push(api.get('/users'));
    }
    Promise.all(reqs).then(([t, c, u]) => {
      setTasks(t.data.data.tasks);
      if (c) setClients(c.data.data.clients);
      if (u) setUsers(u.data.data);
      setDataReady(true);
    });
  }, [user]);

  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const buildContext = () => {
    const today = new Date().toLocaleDateString('en-IN');
    const overdueCount = tasks.filter(isOverdue).length;
    const taskLines = tasks.map(t => {
      const cl  = clients.find(c => c._id === (t.clientId?._id || t.clientId))?.name || t.clientId?.name || '?';
      const emp = users.find(u => u._id === (t.assignedTo?._id || t.assignedTo))?.name || t.assignedTo?.name || '?';
      const od  = isOverdue(t);
      return `• "${t.title}" | Client: ${cl} | Assigned: ${emp} | ${od ? 'OVERDUE' : t.status} | ${t.priority} priority | Due: ${t.deadline?.split('T')[0]} | ${t.progress}% done`;
    });
    return `
FIRM: ${firm?.name || 'CA Firm'} (${firm?.plan || 'free'} plan)
DATE: ${today}
OVERDUE TASKS: ${overdueCount}
CLIENTS (${clients.length}): ${clients.map(c => c.name).join(', ')}
EMPLOYEES (${users.length}): ${users.map(u => u.name).join(', ')}
ALL TASKS (${tasks.length}):
${taskLines.join('\n')}
    `.trim();
  };

  const send = async () => {
    if (!inp.trim() || loading) return;
    const txt = inp.trim();
    setInp('');
    const newMsgs = [...msgs, { role: 'user', content: txt }];
    setMsgs(newMsgs);
    setLoading(true);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are an AI assistant for a CA (Chartered Accountant) firm's practice management system. You have LIVE access to all firm data. Be concise, professional, and specific. Always reference actual task/client/employee names from the data. Use bullet points for lists. Here is the current live firm data:\n\n${buildContext()}`,
          messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || 'No response received.';
      setMsgs(m => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: 'Connection error. Please check your internet and try again.' }]);
    }
    setLoading(false);
  };

  const CHIPS = [
    'Which tasks are overdue right now?',
    'Who has the highest workload?',
    'What should I prioritize today?',
    'Summarize pending tasks by client',
    'Any deadlines this week?',
    'Which employees need support?',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] md:h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="w-10 h-10 bg-amber-400/10 rounded-xl flex items-center justify-center text-amber-400">
          <AiIcon />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-100">AI Insights</h1>
          <p className="text-sm text-slate-500">
            Powered by Claude · {dataReady ? `${tasks.length} tasks loaded` : 'Loading firm data…'}
          </p>
        </div>
      </div>

      {/* Quick chips */}
      <div className="flex flex-wrap gap-2 mb-4 flex-shrink-0">
        {CHIPS.map(c => (
          <button key={c} onClick={() => setInp(c)}
            className="bg-slate-800 border border-slate-700 hover:border-amber-400/50 text-slate-400 hover:text-amber-300 text-xs px-3 py-1.5 rounded-full transition-all">
            {c}
          </button>
        ))}
      </div>

      {/* Chat messages */}
      <div className="flex-1 bg-[#0f172a] border border-slate-800 rounded-xl p-4 overflow-y-auto mb-3 flex flex-col gap-3 min-h-0">
        {msgs.map((m, i) => (
          <div key={i} className={`fade-in text-sm max-w-[85%] ${
            m.role === 'user'
              ? 'self-end bg-amber-400 text-slate-900 font-medium rounded-2xl rounded-br-sm px-4 py-2.5'
              : 'self-start bg-slate-800 text-slate-200 rounded-sm rounded-tl-none rounded-br-2xl rounded-bl-2xl rounded-tr-2xl px-4 py-3 leading-relaxed'
          }`}>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{m.content}</pre>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="self-start bg-slate-800 rounded-2xl px-4 py-3 flex gap-1.5 items-center">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-2 h-2 rounded-full bg-slate-500 inline-block"
                style={{ animation: `pulse-dot .8s ${i * .2}s ease-in-out infinite` }} />
            ))}
          </div>
        )}
        <div ref={ref} />
      </div>

      {/* Input row */}
      <div className="flex gap-2.5 flex-shrink-0">
        <input
          className="input flex-1 bg-[#0f172a] border-slate-800 focus:border-amber-400"
          value={inp}
          onChange={e => setInp(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask about tasks, clients, workload, deadlines…"
          disabled={!dataReady}
        />
        <button className="btn-primary px-4 flex-shrink-0" onClick={send}
          disabled={loading || !inp.trim() || !dataReady}
          style={{ opacity: loading || !inp.trim() || !dataReady ? 0.4 : 1 }}>
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
