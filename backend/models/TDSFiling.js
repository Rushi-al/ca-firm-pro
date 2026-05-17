const mongoose = require('mongoose');

// TDS return types with their statutory deadlines for quarters
const TDS_RETURN_TYPES = {
  '24Q':  { name: '24Q',  description: 'TDS on Salaries' },
  '26Q':  { name: '26Q',  description: 'TDS on other than Salaries' },
  '27Q':  { name: '27Q',  description: 'TDS on Non-Resident payments' },
  '27EQ': { name: '27EQ', description: 'TCS Return' },
};

const tdsFilingSchema = new mongoose.Schema(
  {
    firmId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Firm',   required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },

    returnType: {
      type: String,
      enum: Object.keys(TDS_RETURN_TYPES),
      required: true,
    },

    // Period this filing covers
    period: {
      quarter: { type: Number, min: 1, max: 4, required: true }, // Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
      year:    { type: Number, required: true }, // The calendar year the quarter belongs to
    },

    // Key dates
    dueDate:   { type: Date, required: true },
    filedDate: { type: Date },

    // Status
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'filed', 'overdue'],
      default: 'pending',
    },

    taskId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Filing details
    taxPayable:  { type: Number },
    lateFee:     { type: Number, default: 0 },
    notes:       { type: String },

    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-set status based on dueDate
tdsFilingSchema.pre('save', function (next) {
  if (!this.filedDate) {
    this.status = new Date(this.dueDate) < new Date() ? 'overdue' : 'pending';
  } else {
    this.status = 'filed';
  }
  next();
});

tdsFilingSchema.index({ firmId: 1, clientId: 1, returnType: 1, 'period.quarter': 1, 'period.year': 1 }, { unique: true });

module.exports = mongoose.model('TDSFiling', tdsFilingSchema);
module.exports.TDS_RETURN_TYPES = TDS_RETURN_TYPES;
