const mongoose = require('mongoose');

const recurringTaskSchema = new mongoose.Schema(
  {
    firmId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Firm',   required: true, index: true },
    clientId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    assignedTo:{ type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },

    // Template fields
    titleTemplate: { type: String, required: true },  // e.g. "GST Return Filing {{month}} {{year}}"
    priority:      { type: String, enum: ['Low','Medium','High'], default: 'Medium' },
    notes:         { type: String },

    // Recurrence
    frequency: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly'],
      required: true,
    },

    // Day of month to set deadline (1–28 to be safe)
    deadlineDayOfMonth: { type: Number, default: 20 },

    // How many days before deadline to create the task
    createDaysBefore: { type: Number, default: 15 },

    // Active/paused
    isActive: { type: Boolean, default: true },

    // Tracking
    lastGeneratedAt: { type: Date },
    nextGenerateAt:  { type: Date },
    generatedCount:  { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RecurringTask', recurringTaskSchema);
