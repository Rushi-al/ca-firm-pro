const pdfSvc    = require('../services/pdf.service');
const Task       = require('../models/Task');
const Client     = require('../models/Client');
const GSTFiling  = require('../models/GSTFiling');
const IncomeTax  = require('../models/IncomeTax');
const TimeEntry  = require('../models/TimeEntry');
const Firm       = require('../models/Firm');

// ─────────────────────────────────────────────────────────
// @desc   Generate task report PDF
// @route  GET /api/pdf/tasks?status=&priority=&assignedTo=
// ─────────────────────────────────────────────────────────
exports.taskReport = async (req, res) => {
  try {
    const { status, priority, assignedTo } = req.query;
    const query = { firmId: req.firmId };
    if (status)     query.status     = status;
    if (priority)   query.priority   = priority;
    if (assignedTo) query.assignedTo = assignedTo;

    const [firm, tasks] = await Promise.all([
      Firm.findById(req.firmId),
      Task.find(query)
        .populate('clientId',   'name')
        .populate('assignedTo', 'name')
        .sort({ deadline: 1 }),
    ]);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="task-report-${Date.now()}.pdf"`);

    const stream = pdfSvc.generateTaskReport({
      firmName: firm.name,
      tasks,
      filters:  req.query,
    });
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Generate client summary PDF
// @route  GET /api/pdf/client/:clientId
// ─────────────────────────────────────────────────────────
exports.clientSummary = async (req, res) => {
  try {
    const { clientId } = req.params;

    const [firm, client, tasks, gstFilings, itrRecords, timeEntries] = await Promise.all([
      Firm.findById(req.firmId),
      Client.findOne({ _id: clientId, firmId: req.firmId }),
      Task.find({ firmId: req.firmId, clientId })
        .populate('assignedTo', 'name')
        .sort({ deadline: -1 }),
      GSTFiling.find({ firmId: req.firmId, clientId }).sort({ dueDate: -1 }),
      IncomeTax.find({ firmId: req.firmId, clientId }).sort({ createdAt: -1 }),
      TimeEntry.find({ firmId: req.firmId, clientId }),
    ]);

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found.', data: null });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${client.name.replace(/\s+/g,'-')}-summary-${Date.now()}.pdf"`);

    const stream = pdfSvc.generateClientSummary({
      firmName: firm.name,
      client,
      tasks,
      gstFilings,
      itrRecords,
      timeEntries,
    });
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};
