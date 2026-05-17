const mongoose = require('mongoose');

// ── Subscription ───────────────────────────────────────────
// One document per active/historical subscription per firm
const subscriptionSchema = new mongoose.Schema(
  {
    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },

    // Plan info
    plan:   { type: String, enum: ['free', 'pro', 'enterprise'], required: true },
    cycle:  { type: String, enum: ['monthly', 'yearly'] },

    // Status
    status: {
      type: String,
      enum: ['active', 'past_due', 'cancelled', 'expired', 'trial'],
      default: 'active',
    },

    // Dates
    startDate:   { type: Date, required: true },
    endDate:     { type: Date },           // null = ongoing
    renewsAt:    { type: Date },           // next billing date
    cancelledAt: { type: Date },

    // Razorpay references
    razorpayOrderId:        { type: String },
    razorpayPaymentId:      { type: String },
    razorpaySubscriptionId: { type: String },
    razorpaySignature:      { type: String },

    // Pricing snapshot at time of purchase
    amountPaise: { type: Number },         // e.g. 99900 = ₹999
    currency:    { type: String, default: 'INR' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
