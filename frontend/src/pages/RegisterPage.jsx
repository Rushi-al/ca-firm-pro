import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Field } from '../components/index.jsx';
import { rules, validate } from '../services/validation';

const SCHEMA = {
  firmName:   [rules.required, rules.minLength(2)],
  ownerName:  [rules.required, rules.minLength(2)],
  ownerEmail: [rules.required, rules.email],
  password:   [rules.required, rules.password],
  phone:      [],
};

export default function RegisterPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate  = useNavigate();

  const [form,    setForm]    = useState({ firmName: '', ownerName: '', ownerEmail: '', password: '', phone: '' });
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);

  const getError = (k) => validate(form[k], ...(SCHEMA[k] || []));
  const touch    = (k) => setTouched(t => ({ ...t, [k]: true }));
  const setF     = (k) => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const inputCls = (k) => {
    if (!touched[k]) return 'input';
    return `input ${getError(k) ? 'input-error' : 'input-ok'}`;
  };

  const handleSubmit = async () => {
    // Touch all fields to show errors
    const allTouched = Object.fromEntries(Object.keys(SCHEMA).map(k => [k, true]));
    setTouched(allTouched);
    const hasErrors = Object.keys(SCHEMA).some(k => getError(k));
    if (hasErrors) return;

    setLoading(true);
    try {
      const res = await fetch('/api/firms/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmName:   form.firmName,
          ownerName:  form.ownerName,
          ownerEmail: form.ownerEmail,
          password:   form.password,
          phone:      form.phone,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      // Auto-login after registration
      await login(form.ownerEmail, form.password);
      toast(`Welcome! "${form.firmName}" is ready.`, 'success');
      navigate('/dashboard');
    } catch (err) {
      toast(err.message || 'Registration failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center p-5">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-7">
          <div className="w-14 h-14 bg-amber-400/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-400 text-xl font-black">CA</div>
          <h1 className="text-2xl font-black text-slate-100">Register Your Firm</h1>
          <p className="text-sm text-slate-500 mt-1">Start your free account — no credit card needed</p>
        </div>

        <div className="space-y-1">
          <Field label="Firm / Practice Name" error={getError('firmName')} touched={touched.firmName} required>
            <input className={inputCls('firmName')} placeholder="e.g. Mehta & Associates"
              value={form.firmName} onChange={setF('firmName')} onBlur={() => touch('firmName')} />
          </Field>

          <Field label="Your Full Name" error={getError('ownerName')} touched={touched.ownerName} required>
            <input className={inputCls('ownerName')} placeholder="e.g. Priya Mehta"
              value={form.ownerName} onChange={setF('ownerName')} onBlur={() => touch('ownerName')} />
          </Field>

          <Field label="Email Address" error={getError('ownerEmail')} touched={touched.ownerEmail} required>
            <input className={inputCls('ownerEmail')} type="email" placeholder="you@yourfirm.com"
              value={form.ownerEmail} onChange={setF('ownerEmail')} onBlur={() => touch('ownerEmail')} />
          </Field>

          <Field label="Password" error={getError('password')} touched={touched.password} required>
            <input className={inputCls('password')} type="password" placeholder="Min 8 characters"
              value={form.password} onChange={setF('password')} onBlur={() => touch('password')}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </Field>

          <Field label="Phone Number" error={getError('phone')} touched={touched.phone}>
            <input className={inputCls('phone')} placeholder="10-digit number (optional)"
              value={form.phone} onChange={setF('phone')} onBlur={() => touch('phone')} />
          </Field>
        </div>

        <button className="btn-primary w-full justify-center py-3 mt-5" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Creating your firm…' : 'Create My Firm →'}
        </button>

        {/* Plan info */}
        <div className="mt-5 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <p className="text-xs font-semibold text-slate-300 mb-2">Free Plan Includes:</p>
          <ul className="text-xs text-slate-500 space-y-1">
            <li>✓ 1 Owner + 2 Employees</li>
            <li>✓ Up to 20 Clients</li>
            <li>✓ Unlimited Tasks</li>
            <li>✓ AI Insights</li>
          </ul>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-amber-400 hover:text-amber-300 font-semibold">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
