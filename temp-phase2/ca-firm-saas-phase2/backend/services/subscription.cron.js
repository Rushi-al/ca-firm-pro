const cron     = require('node-cron');
const Firm     = require('../models/Firm');
const User     = require('../models/User');
const emailSvc = require('./email.service');

// ── Run daily at midnight ──────────────────────────────────
cron.schedule('0 0 * * *', async () => {
  console.log('⏰ Running subscription expiry checks…');
  try {
    const now = new Date();

    // ── 1. Expire overdue plans ──────────────────────────
    const expired = await Firm.find({
      plan:         { $ne: 'free' },
      planStatus:   'active',
      planExpiresAt: { $lt: now },
    });

    for (const firm of expired) {
      await Firm.findByIdAndUpdate(firm._id, {
        plan:       'free',
        planStatus: 'expired',
        planCycle:  null,
      });
      console.log(`🔻 Downgraded ${firm.name} → free (plan expired)`);

      // Notify owner
      const owner = await User.findOne({ firmId: firm._id, role: 'Owner' });
      if (owner) {
        await emailSvc.send?.(
          owner.email,
          '⚠️ Your CA Firm Pro plan has expired',
          `<p>Hi ${owner.name}, your ${firm.plan} plan for <strong>${firm.name}</strong> has expired. You've been moved to the Free plan. <a href="${process.env.FRONTEND_URL}/billing">Renew here</a>.</p>`
        );
      }
    }

    // ── 2. Send 7-day expiry warnings ───────────────────
    const in7Days = new Date(now.getTime() + 7 * 864e5);
    const expiringSoon = await Firm.find({
      plan:         { $ne: 'free' },
      planStatus:   'active',
      planExpiresAt: { $gte: now, $lte: in7Days },
    });

    for (const firm of expiringSoon) {
      const daysLeft = Math.ceil((new Date(firm.planExpiresAt) - now) / 864e5);
      const owner    = await User.findOne({ firmId: firm._id, role: 'Owner' });
      if (owner) {
        await emailSvc.sendExpiryWarning({
          to:        owner.email,
          ownerName: owner.name,
          firmName:  firm.name,
          daysLeft,
          renewsAt:  firm.planExpiresAt,
        });
        console.log(`📧 Expiry warning sent to ${owner.email} (${daysLeft} days left)`);
      }
    }

    console.log(`✅ Subscription cron done — ${expired.length} expired, ${expiringSoon.length} warnings sent`);
  } catch (err) {
    console.error('❌ Subscription cron error:', err.message);
  }
});

console.log('✅ Subscription expiry cron scheduled (daily midnight)');
