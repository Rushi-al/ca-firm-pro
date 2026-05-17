const Attachment      = require('../models/Attachment');
const Task            = require('../models/Task');
const ActivityLog     = require('../models/ActivityLog');
const { deleteFromS3, getSignedDownloadUrl } = require('../middleware/upload.middleware');

// ─────────────────────────────────────────────────────────
// @desc   Upload file to a task
// @route  POST /api/tasks/:taskId/attachments
// ─────────────────────────────────────────────────────────
exports.upload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.', data: null });
    }

    // Verify task belongs to this firm
    const task = await Task.findOne({ _id: req.params.taskId, firmId: req.firmId });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.', data: null });

    // Employee can only upload to their own task
    if (req.user.role === 'Employee' && task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.', data: null });
    }

    // Check plan storage limit (Pro: 5GB, Enterprise: 50GB)
    // In production you'd track total storage per firm

    // For S3 uploads, req.file.location = S3 URL, req.file.key = S3 key
    // For local uploads, req.file.path = local path
    const isS3  = !!req.file.location;
    const s3Key = isS3 ? req.file.key : req.file.path;

    // Bump version if file with same name exists
    const existingCount = await Attachment.countDocuments({
      taskId:       req.params.taskId,
      originalName: req.file.originalname,
      isDeleted:    false,
    });

    // Mark previous versions as not latest
    if (existingCount > 0) {
      await Attachment.updateMany(
        { taskId: req.params.taskId, originalName: req.file.originalname },
        { isLatest: false }
      );
    }

    const attachment = await Attachment.create({
      firmId:       req.firmId,
      taskId:       req.params.taskId,
      uploadedBy:   req.user._id,
      originalName: req.file.originalname,
      fileName:     req.file.filename || req.file.key?.split('/').pop(),
      s3Key,
      s3Bucket:     process.env.AWS_S3_BUCKET,
      mimeType:     req.file.mimetype,
      sizeBytes:    req.file.size,
      version:      existingCount + 1,
    });

    await ActivityLog.create({
      firmId:  req.firmId,
      userId:  req.user._id,
      action:  `Uploaded "${req.file.originalname}" to task "${task.title}"`,
      taskId:  task._id,
    });

    res.status(201).json({ success: true, message: 'File uploaded.', data: attachment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   List attachments for a task
// @route  GET /api/tasks/:taskId/attachments
// ─────────────────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.taskId, firmId: req.firmId });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.', data: null });

    const attachments = await Attachment.find({
      taskId:    req.params.taskId,
      firmId:    req.firmId,
      isDeleted: false,
    })
      .populate('uploadedBy', 'name role')
      .sort({ createdAt: -1 });

    // Generate signed URLs for each file
    const withUrls = await Promise.all(
      attachments.map(async (a) => {
        let downloadUrl;
        try {
          downloadUrl = process.env.AWS_ACCESS_KEY_ID
            ? await getSignedDownloadUrl(a.s3Key)
            : `/uploads/${a.s3Key}`; // local fallback
        } catch {
          downloadUrl = null;
        }
        return { ...a.toJSON(), downloadUrl };
      })
    );

    res.json({ success: true, message: 'Attachments fetched.', data: withUrls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Delete attachment
// @route  DELETE /api/tasks/:taskId/attachments/:attachmentId
// ─────────────────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const attachment = await Attachment.findOne({
      _id:    req.params.attachmentId,
      taskId: req.params.taskId,
      firmId: req.firmId,
    });
    if (!attachment) return res.status(404).json({ success: false, message: 'File not found.', data: null });

    // Only Admin/Owner or the uploader can delete
    if (
      req.user.role === 'Employee' &&
      attachment.uploadedBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this file.', data: null });
    }

    // Soft delete
    attachment.isDeleted  = true;
    attachment.deletedAt  = new Date();
    attachment.deletedBy  = req.user._id;
    await attachment.save();

    // Hard delete from S3 (async, don't block response)
    if (process.env.AWS_ACCESS_KEY_ID) {
      deleteFromS3(attachment.s3Key).catch(console.error);
    }

    await ActivityLog.create({
      firmId: req.firmId,
      userId: req.user._id,
      action: `Deleted file "${attachment.originalName}"`,
      taskId: req.params.taskId,
    });

    res.json({ success: true, message: 'File deleted.', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};
