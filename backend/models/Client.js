const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    // ── Multi-tenancy key ──────────────────────────────────
    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },

    name:      { type: String, required: [true, 'Client name is required'], trim: true },
    contact:   { type: String, required: [true, 'Contact is required'], trim: true },
    email:     { type: String, trim: true, lowercase: true },
    gstRegistrationType: {
      type: String,
      enum: ['Registered', 'Unregistered'],
      default: 'Registered'
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        validator: v => !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v),
        message: 'Invalid GST number format',
      },
    },
    pan:       { type: String, trim: true, uppercase: true },
    aadhar:    { type: String, trim: true },
    dob:       { type: Date },
    gstReturnTypes: [{ type: String }],
    isTdsRequired:  { type: Boolean, default: false },
    tdsReturnTypes: [{ type: String }],
    notes:     { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Client name unique within a firm
clientSchema.index({ firmId: 1, name: 1 });

module.exports = mongoose.model('Client', clientSchema);
