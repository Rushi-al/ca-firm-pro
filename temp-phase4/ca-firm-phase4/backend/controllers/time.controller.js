const TimeEntry   = require('../models/TimeEntry');
const Task        = require('../models/Task');
const ActivityLog = require('../models/ActivityLog');

// ─────────────────────────────────────────────────────────
// @desc   Log time entry
// @route  POST /api/time
// ─────────────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { taskId, date, startTime, endTime, durationMins, isBillable, hourlyRate, description } = req.body;

    if (!taskId || !durationMins) {
      return res.status(400).json({ success: false, message: 'taskId and durationMins are required.', data: null });
    }

    // Verify task belongs to this firm
    const task = await Task.findOne({ _id: taskId, firmId: req.firmId }).populate('clientId', '_id name');
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.', data: null });

    // Employee can only log time for their own tasks
    if (req.user.role === 'Employee' && task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only log time for your own tasks.', data: null });
    }

    const entry = await TimeEntry.create({
      firmId:       req.firmId,
      taskId,
      clientId:     task.clientId._id,
      userId:       req.user._id,
      date:         date || new Date(),
      startTime,
      endTime,
      durationMins: Number(durationMins),
      isBillable:   isBillable !== undefined ? isBillable : true,
      hourlyRate:   Number(hourlyRate) || 0,
      description,
    });

    await ActivityLog.create({
      firmId: req.firmId,
      userId: req.user._id,
      action: `Logged ${(durationMins/60).toFixed(1)}h on "${task.title}"`,
      taskId: task._id,
    });

    const populated = await entry.populate(['taskId', 'userId', 'clientId']);
    res.status(201).json({ success: true, message: 'Time logged.', data: populated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Get time entries with filters
// @route  GET /api/time?taskId=&userId=&clientId=&from=&to=&status=
// ─────────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { taskId, userId, clientId, from, to, status, page = 1, limit = 100 } = req.query;
    const query = { firmId: req.firmId };

    // Employees see only their own entries
    if (req.user.role === 'Employee') {
      query.userId = req.user._id;
    } else {
      if (userId)   query.userId   = userId;
      if (clientId) query.clientId = clientId;
    }

    if (taskId) query.taskId = taskId;
    if (status) query.status = status;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to)   query.date.$lte = new Date(to);
    }

    const [entries, total] = await Promise.all([
      TimeEntry.find(query)
        .populate('taskId',   'title')
        .populate('clientId', 'name')
        .populate('userId',   'name role')
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      TimeEntry.countDocuments(query),
    ]);

    // Aggregate totals
    const agg = await TimeEntry.aggregate([
      { $match: { ...query, firmId: require('mongoose').Types.ObjectId.createFromHexString(req.firmId.toString()) } },
      { $group: {
        _id:              null,
        totalMins:        { $sum: '$durationMins' },
        billableMins:     { $sum: { $cond: ['$isBillable', '$durationMins', 0] } },
        totalBilledAmount:{ $sum: '$billedAmount' },
      }},
    ]);

    const summary = agg[0] || { totalMins: 0, billableMins: 0, totalBilledAmount: 0 };

    res.json({
      success: true,
      message: 'Time entries fetched.',
      data: { entries, total, page: Number(page), summary },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Update time entry (owner or Admin)
// @route  PUT /api/time/:id
// ─────────────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const entry = await TimeEntry.findOne({ _id: req.params.id, firmId: req.firmId });
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found.', data: null });

    // Only owner or Admin can edit
    if (req.user.role === 'Employee' && entry.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.', data: null });
    }

    const allowed = ['date','startTime','endTime','durationMins','isBillable','hourlyRate','description'];
    allowed.forEach(k => { if (req.body[k] !== undefined) entry[k] = req.body[k]; });
    await entry.save();

    res.json({ success: true, message: 'Entry updated.', data: entry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Delete time entry
// @route  DELETE /api/time/:id
// ─────────────────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const entry = await TimeEntry.findOne({ _id: req.params.id, firmId: req.firmId });
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found.', data: null });
    if (req.user.role === 'Employee' && entry.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.', data: null });
    }
    await entry.deleteOne();
    res.json({ success: true, message: 'Entry deleted.', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Approve / reject entry (Admin only)
// @route  PUT /api/time/:id/approve
// ─────────────────────────────────────────────────────────
exports.approve = async (req, res) => {
  try {
    const { action, rejectReason } = req.body; // action: 'approve' | 'reject'
    const entry = await TimeEntry.findOne({ _id: req.params.id, firmId: req.firmId });
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found.', data: null });

    entry.status      = action === 'approve' ? 'approved' : 'rejected';
    entry.approvedBy  = req.user._id;
    entry.approvedAt  = new Date();
    if (rejectReason) entry.rejectReason = rejectReason;
    await entry.save();

    res.json({ success: true, message: `Entry ${entry.status}.`, data: entry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Get time report — hours per employee / client / week
// @route  GET /api/time/report?from=&to=&groupBy=employee|client|task
// ─────────────────────────────────────────────────────────
exports.getReport = async (req, res) => {
  try {
    const { from, to, groupBy = 'employee' } = req.query;
    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to)   dateFilter.$lte = new Date(to);

    const match = { firmId: req.firmId };
    if (Object.keys(dateFilter).length) match.date = dateFilter;

    const groupFields = {
      employee: { $group: { _id: '$userId',   totalMins: { $sum: '$durationMins' }, billableMins: { $sum: { $cond: ['$isBillable','$durationMins',0] } }, billed: { $sum: '$billedAmount' }, entries: { $sum: 1 } } },
      client:   { $group: { _id: '$clientId', totalMins: { $sum: '$durationMins' }, billableMins: { $sum: { $cond: ['$isBillable','$durationMins',0] } }, billed: { $sum: '$billedAmount' }, entries: { $sum: 1 } } },
      task:     { $group: { _id: '$taskId',   totalMins: { $sum: '$durationMins' }, billableMins: { $sum: { $cond: ['$isBillable','$durationMins',0] } }, billed: { $sum: '$billedAmount' }, entries: { $sum: 1 } } },
    };

    const lookups = {
      employee: [{ $lookup: { from:'users',   localField:'_id', foreignField:'_id', as:'ref' } }],
      client:   [{ $lookup: { from:'clients', localField:'_id', foreignField:'_id', as:'ref' } }],
      task:     [{ $lookup: { from:'tasks',   localField:'_id', foreignField:'_id', as:'ref' } }],
    };

    const pipeline = [
      { $match: match },
      groupFields[groupBy] || groupFields.employee,
      ...lookups[groupBy],
      { $project: { _id:1, totalMins:1, billableMins:1, billed:1, entries:1, name: { $arrayElemAt: ['$ref.name',0] }, title: { $arrayElemAt: ['$ref.title',0] } } },
      { $sort: { totalMins: -1 } },
    ];

    const rows = await TimeEntry.aggregate(pipeline);

    // Daily trend for chart
    const daily = await TimeEntry.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format:'%Y-%m-%d', date:'$date' } }, totalMins: { $sum: '$durationMins' } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, message: 'Report generated.', data: { rows, daily, groupBy } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};
