const mongoose = require('mongoose');

const timeEntrySchema = new mongoose.Schema(
  {
    firmId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Firm',   required: true, index: true },
    taskId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Task',   required: true, index: true },
    clientId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true, index: true },

    // Time
    date:         { type: Date, required: true, default: Date.now },
    startTime:    { type: String },          // "09:30" HH:MM
    endTime:      { type: String },          // "11:00" HH:MM
    durationMins: { type: Number, required: true, min: 1 }, // total minutes logged

    // Billing
    isBillable:    { type: Boolean, default: true },
    hourlyRate:    { type: Number, default: 0 },    // ₹ per hour
    billedAmount:  { type: Number, default: 0 },    // auto-computed

    description:  { type: String, trim: true },

    // Approval
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt:  { type: Date },
    rejectReason:{ type: String },
  },
  { timestamps: true }
);

// Auto-compute billed amount
timeEntrySchema.pre('save', function (next) {
  if (this.isBillable && this.hourlyRate > 0) {
    this.billedAmount = Math.round((this.durationMins / 60) * this.hourlyRate);
  } else {
    this.billedAmount = 0;
  }
  next();
});

// Virtual: hours
timeEntrySchema.virtual('hours').get(function () {
  return +(this.durationMins / 60).toFixed(2);
});

timeEntrySchema.set('toJSON',   { virtuals: true });
timeEntrySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('TimeEntry', timeEntrySchema);
