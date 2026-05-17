const TDSFiling   = require('../models/TDSFiling');
const Client      = require('../models/Client');
const Task        = require('../models/Task');
const ActivityLog = require('../models/ActivityLog');
const { TDS_RETURN_TYPES } = require('../models/TDSFiling');

// Helper to get due date for a specific quarter and year.
// Q1: Apr-Jun -> Due July 31
// Q2: Jul-Sep -> Due Oct 31
// Q3: Oct-Dec -> Due Jan 31
// Q4: Jan-Mar -> Due May 31
const getDueDate = (quarter, year) => {
  switch(quarter) {
    case 1: return new Date(year, 6, 31);   // July 31
    case 2: return new Date(year, 9, 31);   // Oct 31
    case 3: return new Date(year + 1, 0, 31); // Jan 31 next year
    case 4: return new Date(year + 1, 4, 31); // May 31 next year
    default: return null;
  }
};

const ensureFilingsForQuarter = async (firmId, quarter, year) => {
  const subscribedClients = await Client.find({ firmId, isTdsRequired: true, tdsReturnTypes: { $exists: true, $not: { $size: 0 } } });
  const bulkOps = [];
  for (const client of subscribedClients) {
    for (const rt of client.tdsReturnTypes) {
      if (!TDS_RETURN_TYPES[rt]) continue;

      const dueDate = getDueDate(quarter, year);
      if (!dueDate) continue;

      bulkOps.push({
        updateOne: {
          filter: { firmId, clientId: client._id, returnType: rt, 'period.quarter': quarter, 'period.year': year },
          update: { $setOnInsert: { dueDate, status: new Date(dueDate) < new Date() ? 'overdue' : 'pending' } },
          upsert: true
        }
      });
    }
  }
  if (bulkOps.length > 0) {
    await TDSFiling.bulkWrite(bulkOps);
  }
};

// @desc   Get TDS calendar for a quarter/year
// @route  GET /api/tds/calendar?quarter=&year=
exports.getCalendar = async (req, res) => {
  try {
    const now = new Date();
    // Default to current quarter based on standard FY: Apr-Jun=1, Jul-Sep=2, Oct-Dec=3, Jan-Mar=4
    let currentQuarter = 1;
    let currentYear = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    if (month >= 4 && month <= 6) { currentQuarter = 1; currentYear = now.getFullYear(); }
    else if (month >= 7 && month <= 9) { currentQuarter = 2; currentYear = now.getFullYear(); }
    else if (month >= 10 && month <= 12) { currentQuarter = 3; currentYear = now.getFullYear(); }
    else { currentQuarter = 4; currentYear = now.getFullYear() - 1; }

    const quarter = parseInt(req.query.quarter) || currentQuarter;
    const year    = parseInt(req.query.year)    || currentYear;

    await ensureFilingsForQuarter(req.firmId, quarter, year);

    const query = {
      firmId: req.firmId,
      'period.quarter': quarter,
      'period.year': year,
    };
    if (['Employee', 'Admin'].includes(req.user.role)) {
      query.assignedTo = req.user._id;
    }

    const filings = await TDSFiling.find(query)
      .populate('clientId', 'name tdsReturnTypes')
      .populate('assignedTo', 'name')
      .populate('taskId', 'status')
      .sort({ dueDate: 1 });

    const grouped = filings.reduce((acc, f) => {
      const cid = f.clientId._id.toString();
      if (!acc[cid]) acc[cid] = { client: f.clientId, filings: [] };
      acc[cid].filings.push(f);
      return acc;
    }, {});

    res.json({ success: true, message: 'TDS Calendar fetched.', data: Object.values(grouped) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// @desc   Get upcoming TDS deadlines
// @route  GET /api/tds/upcoming
exports.getUpcoming = async (req, res) => {
  try {
    const now    = new Date();
    const in30   = new Date(now.getTime() + 30 * 864e5);
    
    // Ensure for next few quarters just in case
    // Simplification: We'll just rely on the user visiting the calendar to auto-gen, or we can run the cron.
    // For safety, let's just do a blanket find since we only generate on access right now.
    
    const query = {
      firmId:  req.firmId,
      dueDate: { $gte: now, $lte: in30 },
      status:  { $nin: ['filed'] },
    };
    if (['Employee', 'Admin'].includes(req.user.role)) {
      query.assignedTo = req.user._id;
    }

    const filings = await TDSFiling.find(query)
      .populate('clientId',  'name')
      .populate('assignedTo','name')
      .sort({ dueDate: 1 });

    res.json({ success: true, message: 'Upcoming TDS filings.', data: filings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// @desc   Generate or subscribe to TDS schedules
// @route  POST /api/tds/generate
exports.generateSchedule = async (req, res) => {
  try {
    const { clientId, returnTypes, assignedTo } = req.body;

    if (!clientId || !returnTypes?.length) {
      return res.status(400).json({ success: false, message: 'clientId and returnTypes are required.', data: null });
    }

    const client = await Client.findOneAndUpdate(
      { _id: clientId, firmId: req.firmId },
      { $addToSet: { tdsReturnTypes: { $each: returnTypes } }, isTdsRequired: true },
      { new: true }
    );
    if (!client) return res.status(404).json({ success: false, message: 'Client not found.', data: null });

    await ActivityLog.create({
      firmId:   req.firmId,
      userId:   req.user._id,
      action:   `Subscribed ${client.name} to TDS returns: ${returnTypes.join(', ')}`,
      clientId: client._id,
    });
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'tds' }); } catch (e) {}

    res.status(201).json({
      success: true,
      message: `${client.name} subscribed to TDS. Future filings will generate automatically.`,
      data: null,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// @desc   Remove a TDS return type from a client
// @route  DELETE /api/tds/client/:clientId/return/:returnType
exports.removeSchedule = async (req, res) => {
  try {
    const { clientId, returnType } = req.params;
    
    const client = await Client.findOneAndUpdate(
      { _id: clientId, firmId: req.firmId },
      { $pull: { tdsReturnTypes: returnType } },
      { new: true }
    );
    
    if (!client) return res.status(404).json({ success: false, message: 'Client not found.', data: null });
    
    // Optionally delete unfiled future filings
    const now = new Date();
    await TDSFiling.deleteMany({
      firmId: req.firmId,
      clientId,
      returnType,
      status: 'pending',
      dueDate: { $gt: now }
    });
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'tds' }); } catch (e) {}

    res.json({ success: true, message: `Removed ${returnType} for ${client.name}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// @desc   Mark TDS return as filed
// @route  PUT /api/tds/:id/file
exports.markFiled = async (req, res) => {
  try {
    const { filedDate, notes, taxPayable } = req.body;
    const filing = await TDSFiling.findOneAndUpdate(
      { _id: req.params.id, firmId: req.firmId },
      { status: 'filed', filedDate: filedDate || new Date(), notes, taxPayable },
      { new: true }
    );
    if (!filing) return res.status(404).json({ success: false, message: 'Record not found.', data: null });

    if (filing.taskId) {
      await Task.findByIdAndUpdate(filing.taskId, { status: 'Completed' });
    }
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'tds' }); } catch (e) {}

    res.json({ success: true, message: 'Marked as filed.', data: filing });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// @desc   Create task from TDS filing
// @route  POST /api/tds/:id/create-task
exports.createTaskFromFiling = async (req, res) => {
  try {
    const filing = await TDSFiling.findOne({ _id: req.params.id, firmId: req.firmId }).populate('clientId', 'name');
    if (!filing) return res.status(404).json({ success: false, message: 'Filing not found.', data: null });
    if (filing.taskId) return res.status(400).json({ success: false, message: 'Task already exists.', data: null });

    const task = await Task.create({
      firmId:     req.firmId,
      clientId:   filing.clientId._id,
      assignedTo: filing.assignedTo || req.user._id,
      title:      `TDS ${filing.returnType} Filing — Q${filing.period.quarter} ${filing.period.year}`,
      priority:   'Medium',
      deadline:   filing.dueDate,
      notes:      `Auto-generated task for TDS ${filing.returnType} Return.`,
      createdBy:  req.user._id,
    });

    filing.taskId = task._id;
    filing.status = 'in_progress';
    await filing.save();
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'tds' }); } catch (e) {}

    res.status(201).json({ success: true, message: 'Task created.', data: task });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// @desc   Get return types
// @route  GET /api/tds/return-types
exports.getReturnTypes = (req, res) => {
  res.json({ success: true, message: 'Return types.', data: TDS_RETURN_TYPES });
};
