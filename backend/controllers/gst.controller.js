const GSTFiling  = require('../models/GSTFiling');
const Client     = require('../models/Client');
const Task       = require('../models/Task');
const ActivityLog= require('../models/ActivityLog');
const { GST_RETURN_TYPES } = require('../models/GSTFiling');

// Indian financial year helpers
const getFinancialYear = (date = new Date()) => {
  const month = date.getMonth() + 1; // 1-based
  return month >= 4 ? date.getFullYear() : date.getFullYear() - 1;
};

const getDueDate = (returnType, month, year) => {
  const def = GST_RETURN_TYPES[returnType];
  if (!def) return null;
  // For yearly returns, due date is Dec 31 of next year
  if (def.frequency === 'yearly') return new Date(year + 1, 11, 31);
  // For monthly: due date is def.dayOfMonth of following month
  const dueMonth = month === 12 ? 1 : month + 1;
  const dueYear  = month === 12 ? year + 1 : year;
  return new Date(dueYear, dueMonth - 1, def.dayOfMonth);
};

const ensureFilingsForMonth = async (firmId, month, year) => {
  const subscribedClients = await Client.find({ firmId, gstReturnTypes: { $exists: true, $not: { $size: 0 } } });
  const bulkOps = [];
  for (const client of subscribedClients) {
    for (const rt of client.gstReturnTypes) {
      const def = GST_RETURN_TYPES[rt];
      if (!def) continue;
      if (def.frequency === 'yearly' && month !== (def.month || 12)) continue;

      const dueDate = getDueDate(rt, month, year);
      if (!dueDate) continue;

      bulkOps.push({
        updateOne: {
          filter: { firmId, clientId: client._id, returnType: rt, 'period.month': month, 'period.year': year },
          update: { $setOnInsert: { dueDate, status: new Date(dueDate) < new Date() ? 'overdue' : 'pending' } },
          upsert: true
        }
      });
    }
  }
  if (bulkOps.length > 0) {
    await GSTFiling.bulkWrite(bulkOps);
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Get GST calendar for a month/year
// @route  GET /api/gst/calendar?month=&year=
// ─────────────────────────────────────────────────────────
exports.getCalendar = async (req, res) => {
  try {
    const now   = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year  = parseInt(req.query.year)  || now.getFullYear();

    await ensureFilingsForMonth(req.firmId, month, year);

    const query = {
      firmId: req.firmId,
      $or: [
        { 'period.month': month, 'period.year': year },
        { 'period.year': year, returnType: { $in: ['GSTR-9', 'GSTR-9C'] } },
      ],
    };
    if (['Employee', 'Admin'].includes(req.user.role)) {
      query.assignedTo = req.user._id;
    }

    // Get all filings for this firm in this period
    const filings = await GSTFiling.find(query)
      .populate('clientId', 'name gstNumber')
      .populate('assignedTo', 'name')
      .populate('taskId', 'title status progress')
      .sort({ dueDate: 1 });

    // Summary stats
    const total   = filings.length;
    const filed   = filings.filter(f => f.status === 'filed').length;
    const overdue = filings.filter(f => f.status === 'overdue').length;
    const pending = filings.filter(f => f.status === 'pending').length;

    res.json({
      success: true,
      message: 'GST calendar fetched.',
      data: { filings, summary: { total, filed, overdue, pending }, month, year },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Generate GST filing schedule for a client
//         Creates GSTFiling docs for next 3 months
// @route  POST /api/gst/generate
// @body   { clientId, returnTypes: ['GSTR-1', 'GSTR-3B'], assignedTo }
// ─────────────────────────────────────────────────────────
exports.generateSchedule = async (req, res) => {
  try {
    const { clientId, returnTypes, assignedTo } = req.body;

    if (!clientId || !returnTypes?.length) {
      return res.status(400).json({ success: false, message: 'clientId and returnTypes are required.', data: null });
    }

    // Add return types to client subscription
    const client = await Client.findOneAndUpdate(
      { _id: clientId, firmId: req.firmId },
      { $addToSet: { gstReturnTypes: { $each: returnTypes } } },
      { new: true }
    );
    if (!client) return res.status(404).json({ success: false, message: 'Client not found.', data: null });

    const now      = new Date();
    const created  = [];

    // Generate explicitly for current month + next 11 months to apply assignedTo
    for (let i = 0; i < 12; i++) {
      const d     = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const month = d.getMonth() + 1;
      const year  = d.getFullYear();

      for (const returnType of returnTypes) {
        if (!GST_RETURN_TYPES[returnType]) continue;
        if (GST_RETURN_TYPES[returnType].frequency === 'yearly' && month !== (GST_RETURN_TYPES[returnType].month || 12)) continue;

        const dueDate = getDueDate(returnType, month, year);
        if (!dueDate) continue;

        try {
          const filing = await GSTFiling.create({
            firmId: req.firmId,
            clientId,
            returnType,
            period: { month, year },
            dueDate,
            assignedTo,
            createdBy: req.user._id,
          });
          created.push(filing);
        } catch (err) {
          if (err.code !== 11000) throw err; // ignore duplicates
        }
      }
    }

    await ActivityLog.create({
      firmId:   req.firmId,
      userId:   req.user._id,
      action:   `Subscribed ${client.name} to GST returns: ${returnTypes.join(', ')}`,
      clientId: client._id,
    });
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'gst' }); } catch (e) {}

    res.status(201).json({
      success: true,
      message: `${client.name} subscribed. Future filings will generate automatically.`,
      data: { created },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// @desc   Remove a GST return type from a client
// @route  DELETE /api/gst/client/:clientId/return/:returnType
exports.removeSchedule = async (req, res) => {
  try {
    const { clientId, returnType } = req.params;
    
    const client = await Client.findOneAndUpdate(
      { _id: clientId, firmId: req.firmId },
      { $pull: { gstReturnTypes: returnType } },
      { new: true }
    );
    
    if (!client) return res.status(404).json({ success: false, message: 'Client not found.', data: null });
    
    // Optionally delete unfiled future filings
    const now = new Date();
    await GSTFiling.deleteMany({
      firmId: req.firmId,
      clientId,
      returnType,
      status: 'pending',
      dueDate: { $gt: now }
    });
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'gst' }); } catch (e) {}

    res.json({ success: true, message: `Removed ${returnType} for ${client.name}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Mark a filing as filed
// @route  PUT /api/gst/:id/file
// ─────────────────────────────────────────────────────────
exports.markFiled = async (req, res) => {
  try {
    const { filedDate, turnover, taxPayable, lateFee, notes } = req.body;
    const filing = await GSTFiling.findOneAndUpdate(
      { _id: req.params.id, firmId: req.firmId },
      {
        status:     'filed',
        filedDate:  filedDate || new Date(),
        turnover, taxPayable, lateFee, notes,
      },
      { new: true }
    ).populate('clientId', 'name');

    if (!filing) return res.status(404).json({ success: false, message: 'Filing not found.', data: null });

    await ActivityLog.create({
      firmId: req.firmId,
      userId: req.user._id,
      action: `Marked ${filing.returnType} as filed for ${filing.clientId.name}`,
      clientId: filing.clientId._id,
    });
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'gst' }); } catch (e) {}

    res.json({ success: true, message: 'Filing marked as done.', data: filing });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Create task from a GST filing
// @route  POST /api/gst/:id/create-task
// ─────────────────────────────────────────────────────────
exports.createTaskFromFiling = async (req, res) => {
  try {
    const filing = await GSTFiling.findOne({ _id: req.params.id, firmId: req.firmId })
      .populate('clientId', 'name');
    if (!filing) return res.status(404).json({ success: false, message: 'Filing not found.', data: null });

    if (filing.taskId) {
      return res.status(400).json({ success: false, message: 'Task already exists for this filing.', data: null });
    }

    const monthName = new Date(filing.period.year, (filing.period.month || 1) - 1, 1)
      .toLocaleString('en-IN', { month: 'long' });

    const task = await Task.create({
      firmId:     req.firmId,
      clientId:   filing.clientId._id,
      assignedTo: filing.assignedTo || req.user._id,
      title:      `${filing.returnType} Filing — ${monthName} ${filing.period.year}`,
      priority:   'High',
      deadline:   filing.dueDate,
      notes:      `GST Filing: ${filing.returnType} for ${filing.clientId.name}`,
      createdBy:  req.user._id,
    });

    // Link task to filing
    filing.taskId = task._id;
    await filing.save();
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'gst' }); } catch (e) {}

    res.status(201).json({ success: true, message: 'Task created from filing.', data: task });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Get all return types
// @route  GET /api/gst/return-types
// ─────────────────────────────────────────────────────────
exports.getReturnTypes = (req, res) => {
  res.json({ success: true, message: 'Return types.', data: GST_RETURN_TYPES });
};

// ─────────────────────────────────────────────────────────
// @desc   Get upcoming GST deadlines (next 30 days)
// @route  GET /api/gst/upcoming
// ─────────────────────────────────────────────────────────
exports.getUpcoming = async (req, res) => {
  try {
    const now    = new Date();
    const in30   = new Date(now.getTime() + 30 * 864e5);
    
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    await ensureFilingsForMonth(req.firmId, currentMonth, currentYear);
    await ensureFilingsForMonth(req.firmId, nextMonth, nextYear);

    const query = {
      firmId:  req.firmId,
      dueDate: { $gte: now, $lte: in30 },
      status:  { $ne: 'filed' },
    };
    if (['Employee', 'Admin'].includes(req.user.role)) {
      query.assignedTo = req.user._id;
    }

    const filings = await GSTFiling.find(query)
      .populate('clientId',  'name')
      .populate('assignedTo','name')
      .sort({ dueDate: 1 });

    res.json({ success: true, message: 'Upcoming deadlines.', data: filings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};
