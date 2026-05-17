const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    firmId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action:   { type: String, required: true },
    taskId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    meta:     { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActivityLog', activityLogSchema);
