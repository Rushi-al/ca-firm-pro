const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    firmId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },

    // Invoice number: INV-2024-0001
    invoiceNumber: { type: String, unique: true },

    // Firm snapshot at invoice time
    firmName:    { type: String },
    firmGstin:   { type: String },
    firmAddress: { type: String },
    firmEmail:   { type: String },

    // Line items
    items: [{
      description: String,
      quantity:    { type: Number, default: 1 },
      unitPrice:   Number,   // in paise
      total:       Number,   // in paise
    }],

    // Totals (all in paise)
    subtotal:  { type: Number },
    taxRate:   { type: Number, default: 18 },   // 18% GST
    taxAmount: { type: Number },
    total:     { type: Number },
    currency:  { type: String, default: 'INR' },

    // Payment
    razorpayPaymentId: { type: String },
    status: { type: String, enum: ['paid', 'pending', 'failed'], default: 'paid' },
    paidAt: { type: Date },

    // Plan purchased
    plan:  { type: String },
    cycle: { type: String },
  },
  { timestamps: true }
);

// Auto-generate invoice number before save
invoiceSchema.pre('save', async function (next) {
  if (!this.invoiceNumber) {
    const year  = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
