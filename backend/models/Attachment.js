const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    firmId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Firm',  required: true, index: true },
    taskId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Task',  required: true, index: true },
    uploadedBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // File info
    originalName: { type: String, required: true },
    fileName:     { type: String, required: true },   // stored name in S3
    s3Key:        { type: String, required: true },   // full S3 key path
    s3Bucket:     { type: String },
    mimeType:     { type: String },
    sizeBytes:    { type: Number },

    // Version tracking
    version:      { type: Number, default: 1 },
    isLatest:     { type: Boolean, default: true },

    // Soft delete
    isDeleted:    { type: Boolean, default: false },
    deletedAt:    { type: Date },
    deletedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Attachment', attachmentSchema);
