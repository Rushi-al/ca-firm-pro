const crypto       = require('crypto');
const razorpay     = require('../config/razorpay');
const Firm         = require('../models/Firm');
const Subscription = require('../models/Subscription');
const Invoice      = require('../models/Invoice');
const User         = require('../models/User');
const emailSvc     = require('../services/email.service');

const { PLANS } = require('../models/Firm');

// ── Helpers ────────────────────────────────────────────────
const getPlanPrice = (plan, cycle) => PLANS[plan]?.price?.[cycle] || 0;

const addMonths = (date, n) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
};

// ─────────────────────────────────────────────────────────
// @desc   Get all plan options (public)
// @route  GET /api/billing/plans
// ─────────────────────────────────────────────────────────
exports.getPlans = (req, res) => {
  res.json({ success: true, message: 'Plans fetched.', data: PLANS });
};

// ─────────────────────────────────────────────────────────
// @desc   Create Razorpay order (step 1 of checkout)
// @route  POST /api/billing/create-order
// @body   { plan: 'pro'|'enterprise', cycle: 'monthly'|'yearly' }
// ─────────────────────────────────────────────────────────
exports.createOrder = async (req, res) => {
  try {
    const { plan, cycle } = req.body;

    if (!['pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan.', data: null });
    }
    if (!['monthly', 'yearly'].includes(cycle)) {
      return res.status(400).json({ success: false, message: 'Invalid cycle.', data: null });
    }

    const amountPaise = getPlanPrice(plan, cycle);
    if (!amountPaise) {
      return res.status(400).json({ success: false, message: 'Could not determine price.', data: null });
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt:  `firm_${req.firmId}_${Date.now()}`,
      notes: {
        firmId:   req.firmId.toString(),
        firmName: req.firm.name,
        plan,
        cycle,
      },
    });

    res.json({
      success: true,
      message: 'Order created.',
      data: {
        orderId:     order.id,
        amount:      order.amount,
        currency:    order.currency,
        keyId:       process.env.RAZORPAY_KEY_ID,
        firmName:    req.firm.name,
        ownerEmail:  req.firm.ownerEmail,
        plan,
        cycle,
      },
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Verify payment & activate plan (step 2 of checkout)
// @route  POST /api/billing/verify-payment
// @body   { razorpayOrderId, razorpayPaymentId, razorpaySignature, plan, cycle }
// ─────────────────────────────────────────────────────────
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      plan,
      cycle,
    } = req.body;

    // ── 1. Verify signature ──────────────────────────────
    const body      = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected  = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.', data: null });
    }

    // ── 2. Calculate dates ───────────────────────────────
    const now      = new Date();
    const renewsAt = cycle === 'monthly' ? addMonths(now, 1) : addMonths(now, 12);
    const amount   = getPlanPrice(plan, cycle);

    // ── 3. Update Firm plan ──────────────────────────────
    await Firm.findByIdAndUpdate(req.firmId, {
      plan,
      planCycle:    cycle,
      planStatus:   'active',
      planStartedAt: now,
      planExpiresAt: renewsAt,
      planRenewsAt:  renewsAt,
      isOnTrial:    false,
    });

    // ── 4. Create Subscription record ───────────────────
    const subscription = await Subscription.create({
      firmId:            req.firmId,
      plan,
      cycle,
      status:            'active',
      startDate:         now,
      renewsAt,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      amountPaise:       amount,
    });

    // ── 5. Create Invoice ────────────────────────────────
    const subtotal  = Math.round(amount / 1.18);   // remove GST
    const taxAmount = amount - subtotal;

    const invoice = await Invoice.create({
      firmId:            req.firmId,
      subscriptionId:    subscription._id,
      firmName:          req.firm.name,
      firmGstin:         req.firm.gstin || '',
      firmAddress:       req.firm.address || '',
      firmEmail:         req.firm.ownerEmail,
      items: [{
        description: `CA Firm Pro ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan — ${cycle}`,
        quantity:    1,
        unitPrice:   subtotal,
        total:       subtotal,
      }],
      subtotal,
      taxRate:           18,
      taxAmount,
      total:             amount,
      razorpayPaymentId,
      status:            'paid',
      paidAt:            now,
      plan,
      cycle,
    });

    // ── 6. Send emails ───────────────────────────────────
    const owner = await User.findOne({ firmId: req.firmId, role: 'Owner' });
    if (owner) {
      await emailSvc.sendUpgradeConfirm({
        to:        owner.email,
        ownerName: owner.name,
        plan,
        cycle,
        renewsAt,
      });
      await emailSvc.sendInvoice({
        to:        owner.email,
        ownerName: owner.name,
        invoice,
      });
    }

    res.json({
      success: true,
      message: `🎉 Upgraded to ${plan.toUpperCase()} successfully!`,
      data: { plan, cycle, renewsAt, invoiceNumber: invoice.invoiceNumber },
    });
  } catch (err) {
    console.error('Payment verify error:', err);
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Razorpay webhook handler (raw body required)
// @route  POST /api/billing/webhook
// @access Public (verified by signature)
// ─────────────────────────────────────────────────────────
exports.webhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const expected  = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expected) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const event   = req.body.event;
    const payload = req.body.payload;

    console.log(`📬 Razorpay webhook: ${event}`);

    if (event === 'payment.failed') {
      const notes  = payload?.payment?.entity?.notes;
      const firmId = notes?.firmId;
      if (firmId) {
        await Subscription.findOneAndUpdate(
          { firmId, status: 'active' },
          { status: 'past_due' }
        );
        console.log(`⚠️  Payment failed for firm ${firmId}`);
      }
    }

    if (event === 'subscription.cancelled') {
      const notes  = payload?.subscription?.entity?.notes;
      const firmId = notes?.firmId;
      if (firmId) {
        await Firm.findByIdAndUpdate(firmId, { planStatus: 'cancelled' });
        await Subscription.findOneAndUpdate({ firmId, status: 'active' }, { status: 'cancelled', cancelledAt: new Date() });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Cancel subscription (downgrade to free at period end)
// @route  POST /api/billing/cancel
// ─────────────────────────────────────────────────────────
exports.cancelSubscription = async (req, res) => {
  try {
    const firm = await Firm.findById(req.firmId);
    if (firm.plan === 'free') {
      return res.status(400).json({ success: false, message: 'You are already on the free plan.', data: null });
    }

    // Mark as cancelled — will downgrade at planExpiresAt via cron
    await Firm.findByIdAndUpdate(req.firmId, { planStatus: 'cancelled' });
    await Subscription.findOneAndUpdate(
      { firmId: req.firmId, status: 'active' },
      { status: 'cancelled', cancelledAt: new Date() }
    );

    res.json({
      success: true,
      message: `Subscription cancelled. You will retain ${firm.plan} access until ${firm.planExpiresAt?.toLocaleDateString('en-IN')}.`,
      data: { expiresAt: firm.planExpiresAt },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Get billing overview — current plan + invoices
// @route  GET /api/billing/overview
// ─────────────────────────────────────────────────────────
exports.getOverview = async (req, res) => {
  try {
    const [firm, invoices, subscription] = await Promise.all([
      Firm.findById(req.firmId),
      Invoice.find({ firmId: req.firmId }).sort({ createdAt: -1 }).limit(10),
      Subscription.findOne({ firmId: req.firmId, status: 'active' }).sort({ createdAt: -1 }),
    ]);

    res.json({
      success: true,
      message: 'Billing overview fetched.',
      data: {
        plan:         firm.plan,
        planCycle:    firm.planCycle,
        planStatus:   firm.planStatus,
        planExpiresAt: firm.planExpiresAt,
        planRenewsAt:  firm.planRenewsAt,
        isOnTrial:    firm.isOnTrial,
        trialEndsAt:  firm.trialEndsAt,
        limits:       firm.getLimits(),
        planDetails:  PLANS[firm.plan],
        invoices,
        subscription,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Get single invoice
// @route  GET /api/billing/invoices/:id
// ─────────────────────────────────────────────────────────
exports.getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, firmId: req.firmId });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.', data: null });
    res.json({ success: true, message: 'Invoice fetched.', data: invoice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};
