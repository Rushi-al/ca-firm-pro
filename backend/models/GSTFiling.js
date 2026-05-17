const mongoose = require('mongoose');

// GST return types with their statutory deadlines
const GST_RETURN_TYPES = {
  'GSTR-1':  { name: 'GSTR-1',  description: 'Outward Supplies (Monthly)',   dayOfMonth: 11, frequency: 'monthly'   },
  'GSTR-1Q': { name: 'GSTR-1Q', description: 'Outward Supplies (Quarterly)', dayOfMonth: 13, frequency: 'quarterly' },
  'GSTR-3B': { name: 'GSTR-3B', description: 'Monthly Return',               dayOfMonth: 20, frequency: 'monthly'   },
  'GSTR-9':  { name: 'GSTR-9',  description: 'Annual Return',                month: 12, dayOfMonth: 31, frequency: 'yearly' },
  'GSTR-9C': { name: 'GSTR-9C', description: 'Reconciliation Statement',     month: 12, dayOfMonth: 31, frequency: 'yearly' },
  'GSTR-2B': { name: 'GSTR-2B', description: 'Auto-drafted ITC Statement',   dayOfMonth: 14, frequency: 'monthly'   },
  'CMP-08':  { name: 'CMP-08',  description: 'Composition Scheme Return',    frequency: 'quarterly', dayOfMonth: 18 },
};

const gstFilingSchema = new mongoose.Schema(
  {
    firmId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Firm',   required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },

    returnType: {
      type: String,
      enum: Object.keys(GST_RETURN_TYPES),
      required: true,
    },

    // Period this filing covers
    period: {
      month: { type: Number, min: 1, max: 12 },  // null for yearly
      quarter: { type: Number, min: 1, max: 4 }, // Q1=Apr-Jun, Q2=Jul-Sep etc.
      year:  { type: Number, required: true },    // Financial year e.g. 2024
    },

    // Key dates
    dueDate:   { type: Date, required: true },
    filedDate: { type: Date },          // null = not filed yet

    // Status
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'filed', 'overdue'],
      default: 'pending',
    },

    // Link to task (optional — filing can auto-create a task)
    taskId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Filing details
    turnover:    { type: Number },      // client's turnover for this period
    taxPayable:  { type: Number },      // tax amount
    lateFee:     { type: Number, default: 0 },
    notes:       { type: String },

    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-set status based on dueDate
gstFilingSchema.pre('save', function (next) {
  if (!this.filedDate) {
    this.status = new Date(this.dueDate) < new Date() ? 'overdue' : 'pending';
  } else {
    this.status = 'filed';
  }
  next();
});

gstFilingSchema.index({ firmId: 1, clientId: 1, returnType: 1, 'period.month': 1, 'period.year': 1 }, { unique: true });

module.exports = mongoose.model('GSTFiling', gstFilingSchema);
module.exports.GST_RETURN_TYPES = GST_RETURN_TYPES;
