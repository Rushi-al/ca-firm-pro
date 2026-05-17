import { useState } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export default function TwoFactorPage() {
  const { user }  = useAuth();
  const { toast } = useToast();

  const [step,        setStep]        = useState('idle'); // idle | setup | verify | done
  const [secret,      setSecret]      = useState('');
  const [otpUrl,      setOtpUrl]      = useState('');
  const [token,       setToken]       = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [disableToken,setDisableToken]= useState('');

  const isEnabled = user?.twoFactorEnabled;

  const setup = async () => {
    setLoading(true);
    try {
      const res = await api.post('/auth/2fa/setup');
      setSecret(res.data.data.secret);
      setOtpUrl(res.data.data.otpUrl);
      setStep('setup');
    } catch (err) {
      toast(err.response?.data?.message || 'Setup failed.', 'error');
    } finally { setLoading(false); }
  };

  const enable = async () => {
    if (!token || token.length !== 6) return toast('Enter the 6-digit code from your authenticator.', 'warning');
    setLoading(true);
    try {
      const res = await api.post('/auth/2fa/enable', { token });
      setBackupCodes(res.data.data.backupCodes);
      setStep('done');
      toast('2FA enabled successfully!', 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Invalid code. Try again.', 'error');
    } finally { setLoading(false); }
  };

  const disable = async () => {
    if (!disableToken || disableToken.length !== 6) return toast('Enter your 6-digit authenticator code.', 'warning');
    setLoading(true);
    try {
      await api.post('/auth/2fa/disable', { token: disableToken });
      toast('2FA disabled.', 'info');
      setDisableToken('');
      window.location.reload();
    } catch (err) {
      toast(err.response?.data?.message || 'Invalid code.', 'error');
    } finally { setLoading(false); }
  };

  // Generate QR code using Google Charts API
  const qrUrl = otpUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpUrl)}&bgcolor=0f172a&color=f59e0b`
    : null;

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-slate-100 mb-1">Two-Factor Authentication</h1>
      <p className="text-sm text-slate-500 mb-7">
        Add an extra layer of security to your account using Google Authenticator.
      </p>

      {/* Current status */}
      <div className={`card mb-6 border-l-4 ${isEnabled ? 'border-l-emerald-400' : 'border-l-slate-700'}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{isEnabled ? '🔐' : '🔓'}</span>
          <div>
            <p className="text-sm font-semibold text-slate-100">
              2FA is currently <span className={isEnabled ? 'text-emerald-400' : 'text-slate-400'}>
                {isEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEnabled
                ? 'Your account is protected with TOTP authentication.'
                : 'Enable 2FA to protect your account from unauthorized access.'}
            </p>
          </div>
        </div>
      </div>

      {/* ── SETUP FLOW ───────────────────────────────────── */}
      {!isEnabled && (
        <>
          {step === 'idle' && (
            <div className="card">
              <p className="text-sm font-semibold text-slate-300 mb-4">Set Up 2FA</p>
              <ol className="text-sm text-slate-400 space-y-2 mb-6 list-decimal list-inside">
                <li>Install <strong className="text-slate-200">Google Authenticator</strong> on your phone</li>
                <li>Click "Start Setup" below to get your QR code</li>
                <li>Scan the QR code with the app</li>
                <li>Enter the 6-digit code to confirm</li>
              </ol>
              <button className="btn-primary" onClick={setup} disabled={loading}>
                {loading ? 'Setting up…' : 'Start Setup →'}
              </button>
            </div>
          )}

          {step === 'setup' && (
            <div className="card">
              <p className="text-sm font-semibold text-slate-300 mb-4">Scan QR Code</p>

              {/* QR code */}
              <div className="flex justify-center mb-5">
                <div className="p-3 bg-[#0f172a] border border-slate-700 rounded-xl">
                  {qrUrl ? (
                    <img src={qrUrl} alt="QR Code" className="w-48 h-48 rounded-lg" />
                  ) : (
                    <div className="w-48 h-48 bg-slate-800 rounded-lg flex items-center justify-center">
                      <p className="text-slate-500 text-xs text-center px-4">Loading QR code…</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Manual entry fallback */}
              <div className="mb-5 p-3 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Can't scan? Enter manually in your app:</p>
                <code className="text-xs text-amber-400 font-mono break-all">{secret}</code>
              </div>

              {/* Verify code */}
              <div className="mb-4">
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
                  Enter 6-digit code from authenticator *
                </label>
                <input
                  className="input text-center text-2xl tracking-widest font-mono"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={token}
                  onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && enable()}
                />
              </div>
              <div className="flex gap-3">
                <button className="btn-primary flex-1 justify-center" onClick={enable} disabled={loading || token.length !== 6}>
                  {loading ? 'Verifying…' : 'Enable 2FA'}
                </button>
                <button className="btn-outline flex-1 justify-center" onClick={() => setStep('idle')}>Cancel</button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="card border-emerald-400/30">
              <div className="text-center mb-5">
                <span className="text-4xl">🎉</span>
                <h3 className="text-base font-bold text-emerald-400 mt-3">2FA Enabled!</h3>
                <p className="text-sm text-slate-400 mt-1">Save your backup codes in a safe place.</p>
              </div>

              <div className="p-4 bg-amber-400/5 border border-amber-400/20 rounded-xl mb-5">
                <p className="text-xs font-semibold text-amber-300 mb-3">
                  ⚠️ Backup Codes (one-time use — save these now!)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((c, i) => (
                    <code key={i} className="text-xs font-mono text-slate-200 bg-slate-800 px-3 py-1.5 rounded text-center">
                      {c}
                    </code>
                  ))}
                </div>
              </div>

              <button
                className="btn-outline w-full justify-center"
                onClick={() => { navigator.clipboard.writeText(backupCodes.join('\n')); toast('Backup codes copied!', 'success'); }}>
                Copy Backup Codes
              </button>
            </div>
          )}
        </>
      )}

      {/* ── DISABLE FLOW ─────────────────────────────────── */}
      {isEnabled && (
        <div className="card border-red-400/20">
          <p className="text-sm font-semibold text-slate-300 mb-4">Disable 2FA</p>
          <p className="text-xs text-slate-500 mb-4">
            Enter your current authenticator code to disable 2FA. This will make your account less secure.
          </p>
          <input
            className="input mb-3 text-center text-2xl tracking-widest font-mono"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={disableToken}
            onChange={e => setDisableToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <button className="btn-danger w-full justify-center" onClick={disable}
            disabled={loading || disableToken.length !== 6}>
            {loading ? 'Disabling…' : 'Disable 2FA'}
          </button>
        </div>
      )}
    </div>
  );
}
