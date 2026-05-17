const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const send = async (to, subject, html) => {
  if (!process.env.EMAIL_USER) {
    console.log(`[Email skipped — not configured] To: ${to} | ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
    console.log(`📧 Email sent → ${to}: ${subject}`);
  } catch (err) {
    console.error(`❌ Email failed → ${to}:`, err.message);
  }
};

// ── Welcome email on firm registration ─────────────────────
exports.sendWelcome = async ({ firmName, ownerName, ownerEmail }) => {
  await send(ownerEmail, `Welcome to CA Firm Pro — ${firmName} is ready!`, `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#020817;color:#f1f5f9;padding:32px;border-radius:16px">
      <div style="text-align:center;margin-bottom:28px">
        <div style="background:rgba(245,158,11,.1);border-radius:12px;width:56px;height:56px;display:inline-flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#f59e0b">CA</div>
        <h1 style="color:#f1f5f9;margin-top:16px">Welcome to CA Firm Pro!</h1>
      </div>
      <p style="color:#94a3b8">Hi ${ownerName},</p>
      <p style="color:#94a3b8">Your firm <strong style="color:#f1f5f9">${firmName}</strong> has been successfully registered. You're on the <strong style="color:#f59e0b">Free Plan</strong> — here's what's included:</p>
      <ul style="color:#94a3b8;margin:16px 0">
        <li>✓ Up to 2 Employees</li>
        <li>✓ Up to 20 Clients</li>
        <li>✓ Unlimited Tasks</li>
        <li>✓ AI Insights powered by Claude</li>
      </ul>
      <div style="text-align:center;margin:28px 0">
        <a href="${process.env.FRONTEND_URL}/dashboard" style="background:#f59e0b;color:#020817;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block">Open My Dashboard →</a>
      </div>
      <p style="color:#475569;font-size:12px;text-align:center">Upgrade to Pro anytime for ₹999/month — 10 employees + unlimited clients.</p>
    </div>
  `);
};

// ── Invoice email ───────────────────────────────────────────
exports.sendInvoice = async ({ to, ownerName, invoice }) => {
  const fmt = p => `₹${(p / 100).toFixed(2)}`;
  const rows = invoice.items.map(i =>
    `<tr><td style="padding:8px;border-bottom:1px solid #1e293b">${i.description}</td><td style="padding:8px;border-bottom:1px solid #1e293b;text-align:right">${fmt(i.total)}</td></tr>`
  ).join('');

  await send(to, `Invoice ${invoice.invoiceNumber} — CA Firm Pro`, `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#020817;color:#f1f5f9;padding:32px;border-radius:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px">
        <div>
          <div style="background:rgba(245,158,11,.1);border-radius:8px;width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#f59e0b;font-size:14px">CA</div>
          <h2 style="margin-top:8px;color:#f1f5f9">CA Firm Pro</h2>
        </div>
        <div style="text-align:right">
          <p style="color:#f59e0b;font-weight:700;font-size:18px">${invoice.invoiceNumber}</p>
          <p style="color:#475569;font-size:12px">Date: ${new Date(invoice.paidAt).toLocaleDateString('en-IN')}</p>
          <span style="background:rgba(52,211,153,.1);color:#34d399;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700">PAID</span>
        </div>
      </div>
      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px;margin-bottom:20px">
        <p style="color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Billed To</p>
        <p style="color:#f1f5f9;font-weight:600">${invoice.firmName}</p>
        ${invoice.firmGstin ? `<p style="color:#475569;font-size:12px">GSTIN: ${invoice.firmGstin}</p>` : ''}
        <p style="color:#475569;font-size:12px">${invoice.firmEmail}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead><tr style="background:#0f172a"><th style="padding:10px 8px;text-align:left;color:#475569;font-size:11px;text-transform:uppercase">Description</th><th style="padding:10px 8px;text-align:right;color:#475569;font-size:11px;text-transform:uppercase">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="color:#475569">Subtotal</span><span style="color:#f1f5f9">${fmt(invoice.subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px"><span style="color:#475569">GST (${invoice.taxRate}%)</span><span style="color:#f1f5f9">${fmt(invoice.taxAmount)}</span></div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid #1e293b;padding-top:12px"><span style="color:#f1f5f9;font-weight:700;font-size:16px">Total</span><span style="color:#f59e0b;font-weight:700;font-size:16px">${fmt(invoice.total)}</span></div>
      </div>
      <p style="color:#475569;font-size:12px;text-align:center;margin-top:24px">Payment ID: ${invoice.razorpayPaymentId}</p>
    </div>
  `);
};

// ── Upgrade confirmation ────────────────────────────────────
exports.sendUpgradeConfirm = async ({ to, ownerName, plan, cycle, renewsAt }) => {
  await send(to, `🎉 You're now on CA Firm Pro ${plan.charAt(0).toUpperCase() + plan.slice(1)}!`, `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#020817;color:#f1f5f9;padding:32px;border-radius:16px">
      <h2 style="color:#f59e0b;text-align:center">You've upgraded to ${plan.toUpperCase()}! 🎉</h2>
      <p style="color:#94a3b8">Hi ${ownerName},</p>
      <p style="color:#94a3b8">Your ${cycle} ${plan} subscription is now active.</p>
      <p style="color:#94a3b8">Next renewal: <strong style="color:#f1f5f9">${new Date(renewsAt).toLocaleDateString('en-IN')}</strong></p>
      <div style="text-align:center;margin:28px 0">
        <a href="${process.env.FRONTEND_URL}/settings" style="background:#f59e0b;color:#020817;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block">View My Plan →</a>
      </div>
    </div>
  `);
};

// ── Expiry warning ──────────────────────────────────────────
exports.sendExpiryWarning = async ({ to, ownerName, firmName, daysLeft, renewsAt }) => {
  await send(to, `⚠️ Your CA Firm Pro plan expires in ${daysLeft} days`, `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#020817;color:#f1f5f9;padding:32px;border-radius:16px">
      <h2 style="color:#f87171">Plan Expiring Soon</h2>
      <p style="color:#94a3b8">Hi ${ownerName}, your ${firmName} plan expires on <strong style="color:#f1f5f9">${new Date(renewsAt).toLocaleDateString('en-IN')}</strong> (${daysLeft} days left).</p>
      <p style="color:#94a3b8">After expiry, your firm will revert to the Free plan (2 employees, 20 clients).</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${process.env.FRONTEND_URL}/billing" style="background:#f59e0b;color:#020817;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block">Renew Now →</a>
      </div>
    </div>
  `);
};
