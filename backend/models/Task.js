const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    // ── Multi-tenancy key ──────────────────────────────────
    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },

    title:      { type: String, required: [true, 'Task title is required'], trim: true },
    clientId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    status: {
      type: String,
      enum: ['Not Started', 'In Progress', 'Completed'],
      default: 'Not Started',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    deadline:  { type: Date, required: [true, 'Deadline is required'] },
    progress:  { type: Number, min: 0, max: 100, default: 0 },
    notes:     { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Recurring task support (Phase 6)
    isRecurring:    { type: Boolean, default: false },
    recurringCycle: { type: String, enum: ['monthly', 'quarterly', 'yearly'] },
  },
  { timestamps: true }
);

// Auto-compute status from progress
taskSchema.pre('save', function (next) {
  if      (this.progress === 0)   this.status = 'Not Started';
  else if (this.progress === 100) this.status = 'Completed';
  else                            this.status = 'In Progress';
  next();
});

// Virtual: isOverdue
taskSchema.virtual('isOverdue').get(function () {
  return this.status !== 'Completed' && new Date(this.deadline) < new Date(new Date().toDateString());
});

taskSchema.set('toJSON',   { virtuals: true });
taskSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Task', taskSchema);
