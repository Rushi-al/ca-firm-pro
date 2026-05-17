const Task             = require('../models/Task');
const ActivityLog      = require('../models/ActivityLog');
const notifSvc         = require('../services/notification.service');
const User             = require('../models/User');

// Sign-off schema additions (add to Task model):
// signOff: {
//   status:    { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
//   requestedAt: Date,
//   respondedAt: Date,
//   comment:   String,
// }

// ─────────────────────────────────────────────────────────
// @desc   Request client sign-off on a completed task (Admin)
// @route  POST /api/portal/tasks/:taskId/request-signoff
// ─────────────────────────────────────────────────────────
exports.requestSignOff = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.taskId, firmId: req.firmId })
      .populate('clientId', 'name');

    if (!task) return res.status(404).json({ success: false, message: 'Task not found.', data: null });
    if (task.status !== 'Completed') {
      return res.status(400).json({ success: false, message: 'Only completed tasks can request sign-off.', data: null });
    }

    task.signOff = { status: 'pending', requestedAt: new Date() };
    await task.save();

    await ActivityLog.create({
      firmId:  req.firmId,
      userId:  req.user._id,
      action:  `Requested client sign-off for "${task.title}"`,
      taskId:  task._id,
      clientId:task.clientId._id,
    });

    res.json({ success: true, message: 'Sign-off requested. Client will be notified.', data: task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Client approves or rejects sign-off (Client Portal)
// @route  PUT /api/portal/tasks/:taskId/signoff
// @body   { action: 'approve'|'reject', comment: '' }
// Uses portalUser from clientProtect middleware
// ─────────────────────────────────────────────────────────
exports.clientSignOff = async (req, res) => {
  try {
    const { action, comment } = req.body;
    if (!['approve','reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be approve or reject.', data: null });
    }

    const task = await Task.findOne({
      _id:      req.params.taskId,
      clientId: req.clientId,
      firmId:   req.firmId,
    }).populate('clientId','name').populate('assignedTo','_id name');

    if (!task) return res.status(404).json({ success: false, message: 'Task not found.', data: null });
    if (task.signOff?.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending sign-off request.', data: null });
    }

    task.signOff.status      = action === 'approve' ? 'approved' : 'rejected';
    task.signOff.respondedAt = new Date();
    task.signOff.comment     = comment || '';
    await task.save();

    // Notify firm admins
    const admins = await User.find({ firmId: req.firmId, role: { $in: ['Owner','Admin'] } });
    await notifSvc.createBulk(admins.map(a => ({
      firmId:  req.firmId,
      userId:  a._id,
      type:    'portal_activity',
      title:   `Client ${action === 'approve' ? 'Approved' : 'Rejected'} Sign-off`,
      message: `${task.clientId?.name} has ${action === 'approve' ? 'approved ✓' : 'rejected ✕'} "${task.title}"${comment ? `: "${comment}"` : ''}`,
      taskId:  task._id,
      link:    '/tasks',
    })));

    res.json({
      success: true,
      message: `Task ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
      data: { signOff: task.signOff },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Get tasks pending sign-off (client portal view)
// @route  GET /api/portal/tasks/pending-signoff
// ─────────────────────────────────────────────────────────
exports.getPendingSignOff = async (req, res) => {
  try {
    const tasks = await Task.find({
      clientId: req.clientId,
      firmId:   req.firmId,
      'signOff.status': 'pending',
    }).select('title status deadline signOff createdAt').sort({ 'signOff.requestedAt': -1 });

    res.json({ success: true, message: 'Pending sign-offs.', data: tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};
