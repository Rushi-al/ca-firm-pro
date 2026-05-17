const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    firmId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: {
      type: String,
      enum: [
        'task_assigned',      // new task assigned to employee
        'task_overdue',       // task passed deadline
        'task_completed',     // employee marked task done
        'task_updated',       // progress updated
        'gst_deadline',       // GST filing due soon
        'itr_deadline',       // ITR due soon
        'time_approved',      // time entry approved
        'time_rejected',      // time entry rejected
        'plan_expiring',      // subscription expiring
        'weekly_summary',     // Monday summary
        'portal_activity',    // client did something in portal
        'general',
      ],
      required: true,
    },

    title:   { type: String, required: true },
    message: { type: String, required: true },

    // Optional links
    taskId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Task'   },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    link:     { type: String },   // frontend route e.g. '/tasks'

    isRead:   { type: Boolean, default: false, index: true },
    readAt:   { type: Date },
  },
  { timestamps: true }
);

// Index for fast unread count
notificationSchema.index({ firmId: 1, userId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
