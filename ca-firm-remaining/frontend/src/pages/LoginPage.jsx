import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Field } from '../components/index.jsx';
import { rules, validate } from '../services/validation';

// Password strength checker
const checkStrength = (pw) => {
  if (!pw) return null;
  const checks = {
    length:    pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    number:    /\d/.test(pw),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return { checks, score: passed, label: ['Weak','Weak','Fair','Good','Strong'][passed] };
};

export default function LoginPage() {
  const { login, complete2FA } = useAuth();
  const { toast }              = useToast();
  const navigate               = useNavigate();

  // Login state
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [needs2FA,   setNeeds2FA]   = useState(false);
  const [tempToken,  setTempToken]  = useState('');
  const [tfCode,     setTfCode]     = useState('');
  const [tfLoading,  setTfLoading]  = useState(false);

  const schema = { email: [rules.required, rules.email], password: [rules.required] };
  const getErr = k => validate(form[k], ...(schema[k] || []));
  const touch  = k => setTouched(t => ({ ...t, [k]: true }));
  const setF   = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const cls    = k => `input ${touched[k] ? (getErr(k) ? 'input-error' : 'input-ok') : ''}`;

  const handleLogin = async () => {
    setTouched({ email: true, password: true });
    if (getErr('email') || getErr('password')) return;
    setLoading(true);
    try {
      const data = await login(form.email, form.password);
      if (data.requires2FA) {
        setTempToken(data.tempToken);
        setNeeds2FA(true);
        toast('Enter your 2FA code to continue.', 'info');
      } else {
        toast(`Welcome back, ${data.user.name.split(' ')[0]}!`, 'success');
        navigate('/dashboard');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Invalid email or password.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = async () => {
    if (tfCode.length !== 6) return toast('Enter a 6-digit code.', 'warning');
    setTfLoading(true);
    try {
      const data = await complete2FA(tempToken, tfCode);
      toast(`Welcome back, ${data.user.name.split(' ')[0]}!`, 'success');
      navigate('/dashboard');
    } catch (err) {
      toast(err.response?.data?.message || 'Invalid 2FA code.', 'error');
    } finally {
      setTfLoading(false);
    }
  };

  const fill = (e, p) => { setForm({ email: e, password: p }); setTouched({}); };

  // ── 2FA step ──────────────────────────────────────────────
  if (needs2FA) {
    return (
      <div className="min-h-screen bg-[#020817] flex items-center justify-center p-5">
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8 w-full max-w-sm">
          <div className="text-center mb-7">
            <div className="text-4xl mb-3">🔐</div>
            <h1 className="text-xl font-black text-slate-100">Two-Factor Auth</h1>
            <p className="text-sm text-slate-500 mt-1.5">Enter the 6-digit code from your authenticator app</p>
          </div>
          <input
            className="input text-center text-2xl tracking-widest font-mono mb-4"
            type="text" inputMode="numeric" maxLength={6}
            placeholder="000000"
            value={tfCode}
            onChange={e => setTfCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && handle2FA()}
            autoFocus
          />
          <button className="btn-primary w-full justify-center py-3 mb-3"
            onClick={handle2FA} disabled={tfLoading || tfCode.length !== 6}>
            {tfLoading ? 'Verifying…' : 'Verify →'}
          </button>
          <button className="btn-outline w-full justify-center text-sm"
            onClick={() => { setNeeds2FA(false); setTfCode(''); }}>
            ← Back to Login
          </button>
          <p className="text-xs text-slate-500 text-center mt-4">
            Lost your device? Use a backup code instead.
          </p>
        </div>
      </div>
    );
  }

  // ── Normal login ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center p-5">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="w-14 h-14 bg-amber-400/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-400 text-xl font-black">CA</div>
          <h1 className="text-2xl font-black text-slate-100">CA Firm Pro</h1>
          <p className="text-sm text-slate-500 mt-1">Practice Management System</p>
        </div>

        <Field label="Email" error={getErr('email')} touched={touched.email} required>
          <input className={cls('email')} type="email" placeholder="you@yourfirm.com"
            value={form.email} onChange={setF('email')} onBlur={() => touch('email')}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </Field>

        <Field label="Password" error={getErr('password')} touched={touched.password} required>
          <input className={cls('password')} type="password" placeholder="Your password"
            value={form.password} onChange={setF('password')} onBlur={() => touch('password')}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </Field>

        <button className="btn-primary w-full justify-center py-3 mt-2 mb-5"
          onClick={handleLogin} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In →'}
        </button>

        <div className="border-t border-slate-800 pt-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Demo accounts</p>
          {[
            { firm: 'Mehta & Associates (Pro)', email: 'priya@mehta.com',  pw: 'Admin@123', role: 'Owner'    },
            { firm: 'Mehta — Employee',         email: 'rajesh@mehta.com', pw: 'Emp@12345', role: 'Employee' },
            { firm: 'Shah Tax (Free)',           email: 'owner@shah.com',   pw: 'Admin@123', role: 'Owner'    },
          ].map(d => (
            <button key={d.email} onClick={() => fill(d.email, d.pw)}
              className="w-full text-left bg-slate-800 border border-slate-700 hover:border-amber-400/50 rounded-xl p-3 mb-2 transition-colors">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-amber-400 font-bold">{d.role}</span>
                <span className="text-xs text-slate-600">{d.firm}</span>
              </div>
              <p className="text-xs text-slate-400 font-mono">{d.email}</p>
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          New CA firm?{' '}
          <Link to="/register" className="text-amber-400 hover:text-amber-300 font-semibold">Register here →</Link>
        </p>
      </div>
    </div>
  );
}
