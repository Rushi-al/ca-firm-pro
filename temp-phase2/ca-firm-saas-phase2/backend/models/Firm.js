const mongoose = require('mongoose');

// Plan definitions — single source of truth
const PLANS = {
  free: {
    name:        'Free',
    price:       { monthly: 0, yearly: 0 },
    limits:      { employees: 2, clients: 20, storage: 0 },
    features:    ['2 Employees', '20 Clients', 'Unlimited Tasks', 'AI Insights'],
  },
  pro: {
    name:        'Pro',
    price:       { monthly: 99900, yearly: 999900 },   // paise
    limits:      { employees: 10, clients: 999999, storage: 5 * 1024 },  // 5GB
    features:    ['10 Employees', 'Unlimited Clients', 'File Attachments (5GB)', 'Priority Support', 'Email Reminders', 'Advanced Reports'],
  },
  enterprise: {
    name:        'Enterprise',
    price:       { monthly: 299900, yearly: 2999900 },
    limits:      { employees: 999999, clients: 999999, storage: 50 * 1024 },
    features:    ['Unlimited Employees', 'Unlimited Clients', 'File Attachments (50GB)', 'Dedicated Support', 'Custom Domain', 'API Access', 'WhatsApp Alerts'],
  },
};

const firmSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true },
    slug:       { type: String, unique: true, lowercase: true, trim: true },
    ownerEmail: { type: String, required: true, lowercase: true, trim: true },
    phone:      { type: String, trim: true },
    address:    { type: String, trim: true },
    gstin:      { type: String, trim: true, uppercase: true },
    logoUrl:    { type: String },

    // ── Subscription / Plan ────────────────────────────────
    plan:         { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    planCycle:    { type: String, enum: ['monthly', 'yearly'] },
    planStatus:   { type: String, enum: ['active', 'past_due', 'cancelled', 'expired'], default: 'active' },
    planStartedAt: { type: Date },
    planExpiresAt: { type: Date },
    planRenewsAt:  { type: Date },

    // Trial
    trialEndsAt:  { type: Date },
    isOnTrial:    { type: Boolean, default: false },

    // Razorpay customer
    razorpayCustomerId: { type: String },

    // Soft delete / suspension
    isActive:      { type: Boolean, default: true },
    suspendedAt:   { type: Date },
    suspendReason: { type: String },
  },
  { timestamps: true }
);

// Auto slug
firmSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

// Plan limits
firmSchema.methods.getLimits = function () {
  return PLANS[this.plan]?.limits || PLANS.free.limits;
};

// Is plan currently active (not expired)
firmSchema.methods.isPlanActive = function () {
  if (this.plan === 'free') return true;
  if (this.planStatus !== 'active') return false;
  if (this.planExpiresAt && new Date() > this.planExpiresAt) return false;
  return true;
};

module.exports = mongoose.model('Firm', firmSchema);
module.exports.PLANS = PLANS;
