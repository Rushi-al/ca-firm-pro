const mongoose = require('mongoose');

// All ITR form types
const ITR_FORMS = {
  'ITR-1':  { name: 'ITR-1 (Sahaj)',   description: 'Salaried individuals, pension, one house property',     deadline: { month: 7, day: 31 } },
  'ITR-2':  { name: 'ITR-2',           description: 'Capital gains, foreign income, more than one property', deadline: { month: 7, day: 31 } },
  'ITR-3':  { name: 'ITR-3',           description: 'Business/profession income with accounts',               deadline: { month: 9, day: 30 } },
  'ITR-4':  { name: 'ITR-4 (Sugam)',   description: 'Presumptive income (44AD/44ADA/44AE)',                  deadline: { month: 7, day: 31 } },
  'ITR-5':  { name: 'ITR-5',           description: 'Partnership firms, LLPs, AOPs, BOIs',                   deadline: { month: 9, day: 30 } },
  'ITR-6':  { name: 'ITR-6',           description: 'Companies (not claiming 11 exemption)',                  deadline: { month: 9, day: 30 } },
  'ITR-7':  { name: 'ITR-7',           description: 'Trusts, political parties, research institutions',       deadline: { month: 9, day: 30 } },
};

// Advance tax due dates (India)
const ADVANCE_TAX_DATES = [
  { quarter: 'Q1', dueDay: 15, dueMonth: 6,  percentage: 15  },  // Jun 15
  { quarter: 'Q2', dueDay: 15, dueMonth: 9,  percentage: 45  },  // Sep 15
  { quarter: 'Q3', dueDay: 15, dueMonth: 12, percentage: 75  },  // Dec 15
  { quarter: 'Q4', dueDay: 15, dueMonth: 3,  percentage: 100 },  // Mar 15
];

const incomeTaxSchema = new mongoose.Schema(
  {
    firmId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Firm',   required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },

    // Assessment year e.g. "2024-25" (year of filing, covers prev FY)
    assessmentYear: { type: String, required: true },  // "2024-25"
    financialYear:  { type: String, required: true },  // "2023-24"

    itrForm: {
      type: String,
      enum: Object.keys(ITR_FORMS),
      required: true,
    },

    // Key dates
    dueDate:    { type: Date, required: true },
    filedDate:  { type: Date },
    revisedDate:{ type: Date },  // if revised return filed

    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'filed', 'revised', 'overdue'],
      default: 'not_started',
    },

    isItrFiled: { type: Boolean, default: false },
    isAccountsCompleted: { type: Boolean, default: false },

    // Financial details
    grossIncome:      { type: Number },   // ₹
    taxableIncome:    { type: Number },
    taxPayable:       { type: Number },
    taxPaid:          { type: Number },
    refundAmount:     { type: Number },
    interestPayable:  { type: Number },   // 234A, 234B, 234C

    // Deductions (80C, 80D etc.)
    deductions: {
      section80C:  { type: Number, default: 0 },
      section80D:  { type: Number, default: 0 },
      section80G:  { type: Number, default: 0 },
      other:       { type: Number, default: 0 },
    },

    // Acknowledgement
    ackNumber:  { type: String },   // ITR-V acknowledgement number
    ackDate:    { type: Date },

    // Advance tax tracking
    advanceTax: [{
      quarter:   String,
      dueDate:   Date,
      paidDate:  Date,
      paidAmount:{ type: Number, default: 0 },
      status:    { type: String, enum: ['pending','paid','partial'], default: 'pending' },
    }],

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    taskId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    notes:      { type: String },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Unique: one ITR record per client per assessment year per form
incomeTaxSchema.index({ firmId: 1, clientId: 1, assessmentYear: 1, itrForm: 1 }, { unique: true });

// Auto-set status
incomeTaxSchema.pre('save', function (next) {
  if (this.isItrFiled || this.filedDate) {
    this.status = this.revisedDate ? 'revised' : 'filed';
  } else if (new Date(this.dueDate) < new Date()) {
    this.status = 'overdue';
  }
  next();
});

module.exports = mongoose.model('IncomeTax', incomeTaxSchema);
module.exports.ITR_FORMS = ITR_FORMS;
module.exports.ADVANCE_TAX_DATES = ADVANCE_TAX_DATES;
