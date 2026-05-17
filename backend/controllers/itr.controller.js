const IncomeTax   = require('../models/IncomeTax');
const Client      = require('../models/Client');
const Task        = require('../models/Task');
const ActivityLog = require('../models/ActivityLog');
const { ITR_FORMS, ADVANCE_TAX_DATES } = require('../models/IncomeTax');

// Helper — build due date from ITR form + assessment year
const buildDueDate = (itrForm, assessmentYear) => {
  const def = ITR_FORMS[itrForm];
  if (!def) return null;
  // Assessment year "2024-25" → calendar year 2024
  const calYear = parseInt(assessmentYear.split('-')[0]);
  return new Date(calYear, def.deadline.month - 1, def.deadline.day);
};

// Helper — current assessment year
const getCurrentAY = () => {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  // After April 1 → new AY starts
  if (month >= 4) return `${year}-${String(year + 1).slice(2)}`;
  return `${year - 1}-${String(year).slice(2)}`;
};

// ─────────────────────────────────────────────────────────
// @desc   Get all ITR records for this firm
// @route  GET /api/itr?assessmentYear=&status=&clientId=
// ─────────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { assessmentYear, status, clientId, page = 1, limit = 50 } = req.query;
    const query = { firmId: req.firmId };
    if (assessmentYear) query.assessmentYear = assessmentYear;
    if (status)         query.status         = status;
    if (clientId)       query.clientId       = clientId;
    if (['Employee', 'Admin'].includes(req.user.role)) {
      query.assignedTo = req.user._id;
    }

    const [records, total] = await Promise.all([
      IncomeTax.find(query)
        .populate('clientId',   'name gstNumber')
        .populate('assignedTo', 'name')
        .populate('taskId',     'title status')
        .sort({ dueDate: 1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      IncomeTax.countDocuments(query),
    ]);

    const summary = {
      total,
      filed:       records.filter(r => r.status === 'filed').length,
      overdue:     records.filter(r => r.status === 'overdue').length,
      not_started: records.filter(r => r.status === 'not_started').length,
      in_progress: records.filter(r => r.status === 'in_progress').length,
    };

    res.json({ success: true, message: 'ITR records fetched.', data: { records, total, summary, page: Number(page) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Create ITR record
// @route  POST /api/itr
// ─────────────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { clientId, itrForm, assessmentYear, financialYear, assignedTo, notes } = req.body;

    if (!clientId || !itrForm || !assessmentYear) {
      return res.status(400).json({ success: false, message: 'clientId, itrForm, and assessmentYear are required.', data: null });
    }

    const client  = await Client.findOne({ _id: clientId, firmId: req.firmId });
    if (!client) return res.status(404).json({ success: false, message: 'Client not found.', data: null });

    const dueDate = buildDueDate(itrForm, assessmentYear);

    // Build advance tax schedule
    const ay          = parseInt(assessmentYear.split('-')[0]);
    const advanceTax  = ADVANCE_TAX_DATES.map(atd => ({
      quarter:   atd.quarter,
      dueDate:   new Date(atd.dueMonth <= 3 ? ay + 1 : ay, atd.dueMonth - 1, atd.dueDay),
      paidAmount:0,
      status:    'pending',
    }));

    const record = await IncomeTax.create({
      firmId: req.firmId,
      clientId, itrForm, assessmentYear,
      financialYear: financialYear || `${parseInt(assessmentYear) - 1}-${assessmentYear.split('-')[1]}`,
      dueDate,
      advanceTax,
      assignedTo,
      notes,
      createdBy: req.user._id,
    });

    await ActivityLog.create({
      firmId:   req.firmId,
      userId:   req.user._id,
      action:   `Created ITR record: ${itrForm} for ${client.name} (AY ${assessmentYear})`,
      clientId: client._id,
    });
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'itr' }); } catch (e) {}

    const populated = await record.populate(['clientId', 'assignedTo']);
    res.status(201).json({ success: true, message: 'ITR record created.', data: populated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Update ITR record (financials, filing details)
// @route  PUT /api/itr/:id
// ─────────────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const record = await IncomeTax.findOne({ _id: req.params.id, firmId: req.firmId });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found.', data: null });

    const allowed = [
      'status','isItrFiled','isAccountsCompleted','filedDate','revisedDate','ackNumber','ackDate',
      'grossIncome','taxableIncome','taxPayable','taxPaid',
      'refundAmount','interestPayable','deductions','assignedTo',
      'notes','advanceTax',
    ];
    allowed.forEach(k => { if (req.body[k] !== undefined) record[k] = req.body[k]; });
    await record.save();

    await ActivityLog.create({
      firmId:   req.firmId,
      userId:   req.user._id,
      action:   `Updated ITR ${record.itrForm} for AY ${record.assessmentYear} — status: ${record.status}`,
      clientId: record.clientId,
    });
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'itr' }); } catch (e) {}

    const populated = await record.populate(['clientId','assignedTo']);
    res.json({ success: true, message: 'ITR record updated.', data: populated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Create task from ITR record
// @route  POST /api/itr/:id/create-task
// ─────────────────────────────────────────────────────────
exports.createTask = async (req, res) => {
  try {
    const record = await IncomeTax.findOne({ _id: req.params.id, firmId: req.firmId })
      .populate('clientId', 'name');

    if (!record) return res.status(404).json({ success: false, message: 'Record not found.', data: null });
    if (record.taskId) return res.status(400).json({ success: false, message: 'Task already exists.', data: null });

    const task = await Task.create({
      firmId:     req.firmId,
      clientId:   record.clientId._id,
      assignedTo: record.assignedTo || req.user._id,
      title:      `${record.itrForm} Filing — AY ${record.assessmentYear}`,
      priority:   'High',
      deadline:   record.dueDate,
      notes:      `Income Tax Return: ${record.itrForm} for ${record.clientId.name}`,
      createdBy:  req.user._id,
    });

    record.taskId = task._id;
    record.status = 'in_progress';
    await record.save();
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'itr' }); } catch (e) {}

    res.status(201).json({ success: true, message: 'Task created.', data: task });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Get upcoming ITR deadlines (next 60 days)
// @route  GET /api/itr/upcoming
// ─────────────────────────────────────────────────────────
exports.getUpcoming = async (req, res) => {
  try {
    const now   = new Date();
    const in60  = new Date(now.getTime() + 60 * 864e5);
    const query = {
      firmId:  req.firmId,
      dueDate: { $gte: now, $lte: in60 },
      status:  { $nin: ['filed','revised'] },
    };
    if (['Employee', 'Admin'].includes(req.user.role)) {
      query.assignedTo = req.user._id;
    }

    const records = await IncomeTax.find(query)
      .populate('clientId',  'name')
      .populate('assignedTo','name')
      .sort({ dueDate: 1 });

    res.json({ success: true, message: 'Upcoming ITR deadlines.', data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Get ITR form types
// @route  GET /api/itr/forms
// ─────────────────────────────────────────────────────────
exports.getForms = (req, res) => {
  res.json({ success: true, message: 'ITR forms.', data: ITR_FORMS });
};

// ─────────────────────────────────────────────────────────
// @desc   Delete ITR record
// @route  DELETE /api/itr/:id
// ─────────────────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const record = await IncomeTax.findOneAndDelete({ _id: req.params.id, firmId: req.firmId });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found.', data: null });
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'itr' }); } catch (e) {}
    res.json({ success: true, message: 'ITR record deleted.', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};
