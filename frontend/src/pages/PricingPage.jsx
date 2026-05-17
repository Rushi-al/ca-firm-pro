import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

const fmt = p => p === 0 ? 'Free' : `₹${(p / 100).toLocaleString('en-IN')}`;

const CheckIcon = () => (
  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
  </svg>
);

export default function PricingPage() {
  const { user, firm } = useAuth();
  const { toast }      = useToast();
  const navigate       = useNavigate();
  const [cycle,    setCycle]    = useState('monthly');
  const [loading,  setLoading]  = useState(null); // which plan is loading
  const [plans,    setPlans]    = useState(null);

  useEffect(() => {
    document.title = 'Pricing | CA Firm Pro';
    api.get('/billing/plans').then(r => setPlans(r.data.data));
  }, []);

  const loadRazorpay = () =>
    new Promise(resolve => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload  = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const handleUpgrade = async (plan) => {
    if (!user) return navigate('/register');
    if (firm?.plan === plan) return toast('You are already on this plan.', 'info');
    if (plan === 'free') return navigate('/billing');

    setLoading(plan);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Could not load Razorpay. Check your internet connection.');

      // Create order
      const orderRes = await api.post('/billing/create-order', { plan, cycle });
      const order    = orderRes.data.data;

      // Simulate payment if using placeholder keys
      if (order.keyId === 'rzp_test_your_key') {
        toast('Simulating payment...', 'info');
        const verifyRes = await api.post('/billing/verify-payment', {
          razorpayOrderId:   order.orderId,
          razorpayPaymentId: `mock_pay_${Date.now()}`,
          razorpaySignature: 'mock_signature',
          plan,
          cycle,
        });
        toast(verifyRes.data.message, 'success');
        setTimeout(() => window.location.href = '/billing', 1500);
        return;
      }

      // Open Razorpay checkout
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key:         order.keyId,
          amount:      order.amount,
          currency:    order.currency,
          name:        'CA Firm Pro',
          description: `${plan.charAt(0).toUpperCase()+plan.slice(1)} Plan — ${cycle}`,
          order_id:    order.orderId,
          prefill: {
            name:    user.name,
            email:   order.ownerEmail,
          },
          theme: { color: '#f59e0b' },
          modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
          handler: async (response) => {
            try {
              // Verify with backend
              const verifyRes = await api.post('/billing/verify-payment', {
                razorpayOrderId:   response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                plan,
                cycle,
              });
              toast(verifyRes.data.message, 'success');
              // Reload page to refresh firm plan
              setTimeout(() => window.location.href = '/billing', 1500);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        });
        rzp.open();
      });
    } catch (err) {
      if (err.message !== 'Payment cancelled.') {
        toast(err.response?.data?.message || err.message, 'error');
      }
    } finally {
      setLoading(null);
    }
  };

  const PLAN_ORDER = ['free', 'pro', 'enterprise'];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-black text-slate-100 mb-3">Simple, Transparent Pricing</h1>
        <p className="text-slate-400 mb-7">Choose the plan that fits your practice. Upgrade or cancel anytime.</p>

        {/* Billing cycle toggle */}
        <div className="inline-flex items-center bg-slate-800 rounded-xl p-1 gap-1">
          {['monthly', 'yearly'].map(c => (
            <button key={c} onClick={() => setCycle(c)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                cycle === c ? 'bg-amber-400 text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
              {c === 'yearly' && <span className="ml-1.5 text-xs bg-emerald-400/20 text-emerald-400 px-1.5 py-0.5 rounded-full">Save 17%</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
        {plans && PLAN_ORDER.map(key => {
          const p         = plans[key];
          const price     = p.price[cycle];
          const isCurrent = firm?.plan === key;
          const isPro     = key === 'pro';

          return (
            <div key={key} className={`relative rounded-2xl p-6 border transition-all ${
              isPro
                ? 'bg-amber-400/5 border-amber-400/40 shadow-lg shadow-amber-400/5'
                : 'bg-[#0f172a] border-slate-800'
            }`}>
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-amber-400 text-slate-900 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">Most Popular</span>
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-base font-bold text-slate-100 mb-1">{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-3xl font-black ${isPro ? 'text-amber-400' : 'text-slate-100'}`}>
                    {fmt(price)}
                  </span>
                  {price > 0 && <span className="text-slate-500 text-sm">/{cycle === 'monthly' ? 'mo' : 'yr'}</span>}
                </div>
                {price > 0 && cycle === 'yearly' && (
                  <p className="text-xs text-emerald-400">
                    ₹{Math.round(price / 1200).toLocaleString('en-IN')}/month, billed yearly
                  </p>
                )}
              </div>

              <ul className="space-y-2.5 mb-7">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                    <CheckIcon /> {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(key)}
                disabled={isCurrent || loading === key}
                className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  isCurrent
                    ? 'bg-slate-800 text-slate-500 cursor-default'
                    : isPro
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-900 disabled:opacity-50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-50'
                }`}>
                {loading === key
                  ? 'Opening checkout…'
                  : isCurrent
                  ? '✓ Current Plan'
                  : key === 'free'
                  ? 'Downgrade to Free'
                  : `Upgrade to ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="card max-w-2xl mx-auto">
        <h3 className="text-sm font-semibold text-slate-300 mb-5">Frequently Asked Questions</h3>
        {[
          { q: 'Can I upgrade or downgrade anytime?', a: 'Yes. Upgrades take effect immediately. Downgrades take effect at the end of your current billing period.' },
          { q: 'What payment methods are accepted?', a: 'All major cards (Visa, Mastercard, RuPay), UPI (GPay, PhonePe, BHIM), Net Banking, and Wallets via Razorpay.' },
          { q: 'Will I get a GST invoice?', a: 'Yes — a detailed invoice with GST breakdown is emailed immediately after payment and available in your billing dashboard.' },
          { q: 'What happens when I hit plan limits?', a: 'You will be notified and prompted to upgrade. Existing data is never deleted — you just cannot add more until you upgrade.' },
          { q: 'Is my data secure?', a: 'Absolutely. Each firm\'s data is fully isolated. We use bcrypt password hashing, JWT auth, rate limiting, and input sanitization.' },
        ].map(({ q, a }) => (
          <div key={q} className="py-4 border-b border-slate-800 last:border-0">
            <p className="text-sm font-semibold text-slate-200 mb-1">{q}</p>
            <p className="text-sm text-slate-500">{a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
