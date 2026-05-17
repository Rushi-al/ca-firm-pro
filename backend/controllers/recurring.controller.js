const RecurringTask = require('../models/RecurringTask');
const Task          = require('../models/Task');
const ActivityLog   = require('../models/ActivityLog');
const cron          = require('node-cron');

// ── Helpers ────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const QUARTERS = { 1:'Q1 (Apr-Jun)', 2:'Q2 (Jul-Sep)', 3:'Q3 (Oct-Dec)', 4:'Q4 (Jan-Mar)' };

const buildTitle = (template, date) => {
  const month   = MONTHS[date.getMonth()];
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  const year    = date.getFullYear();
  const fy      = date.getMonth() >= 3 ? `FY ${year}-${year+1}` : `FY ${year-1}-${year}`;
  return template
    .replace('{{month}}',   month)
    .replace('{{quarter}}', QUARTERS[quarter])
    .replace('{{year}}',    year)
    .replace('{{fy}}',      fy);
};

const getNextDeadline = (frequency, deadlineDayOfMonth) => {
  const now = new Date();
  let d = new Date(now);

  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      d.setDate(deadlineDayOfMonth);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      d.setDate(deadlineDayOfMonth);
      break;
    case 'half-yearly':
      d.setMonth(d.getMonth() + 6);
      d.setDate(deadlineDayOfMonth);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      d.setDate(deadlineDayOfMonth);
      break;
  }
  return d;
};

// ─────────────────────────────────────────────────────────
// @desc   List recurring task templates
// @route  GET /api/recurring
// ─────────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const templates = await RecurringTask.find({ firmId: req.firmId })
      .populate('clientId',  'name')
      .populate('assignedTo','name')
      .sort({ createdAt: -1 });
    res.json({ success: true, message: 'Recurring tasks fetched.', data: templates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Create recurring task template
// @route  POST /api/recurring
// ─────────────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { titleTemplate, clientId, assignedTo, frequency, priority, deadlineDayOfMonth, createDaysBefore, notes } = req.body;
    const nextGenerateAt = getNextDeadline(frequency, deadlineDayOfMonth || 20);
    // Subtract createDaysBefore
    nextGenerateAt.setDate(nextGenerateAt.getDate() - (createDaysBefore || 15));

    const template = await RecurringTask.create({
      firmId: req.firmId,
      titleTemplate, clientId, assignedTo, frequency,
      priority, deadlineDayOfMonth, createDaysBefore, notes,
      nextGenerateAt,
      createdBy: req.user._id,
    });

    await ActivityLog.create({
      firmId: req.firmId,
      userId: req.user._id,
      action: `Created recurring task template: "${titleTemplate}" (${frequency})`,
    });

    const populated = await template.populate(['clientId','assignedTo']);
    res.status(201).json({ success: true, message: 'Recurring task created.', data: populated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Toggle active/paused
// @route  PUT /api/recurring/:id/toggle
// ─────────────────────────────────────────────────────────
exports.toggle = async (req, res) => {
  try {
    const t = await RecurringTask.findOne({ _id: req.params.id, firmId: req.firmId });
    if (!t) return res.status(404).json({ success: false, message: 'Not found.', data: null });
    t.isActive = !t.isActive;
    await t.save();
    res.json({ success: true, message: `Template ${t.isActive ? 'activated' : 'paused'}.`, data: t });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Delete template
// @route  DELETE /api/recurring/:id
// ─────────────────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    await RecurringTask.findOneAndDelete({ _id: req.params.id, firmId: req.firmId });
    res.json({ success: true, message: 'Template deleted.', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// Cron: Run daily at 6AM — generate tasks from templates
// ─────────────────────────────────────────────────────────
cron.schedule('0 6 * * *', async () => {
  console.log('⏰ Recurring tasks cron running…');
  try {
    const now       = new Date();
    const templates = await RecurringTask.find({
      isActive:        true,
      nextGenerateAt:  { $lte: now },
    }).populate('clientId', 'name');

    let generated = 0;
    for (const t of templates) {
      const deadline = getNextDeadline(t.frequency, t.deadlineDayOfMonth);
      const title    = buildTitle(t.titleTemplate, deadline);

      // Avoid duplicates
      const exists = await Task.findOne({ firmId: t.firmId, title, assignedTo: t.assignedTo });
      if (exists) continue;

      await Task.create({
        firmId:     t.firmId,
        clientId:   t.clientId._id,
        assignedTo: t.assignedTo,
        title,
        priority:   t.priority,
        deadline,
        notes:      t.notes || `Auto-generated from recurring template`,
        createdBy:  t.createdBy,
      });

      // Update template next run date
      const nextRun = getNextDeadline(t.frequency, t.deadlineDayOfMonth);
      nextRun.setDate(nextRun.getDate() - t.createDaysBefore);
      t.lastGeneratedAt = now;
      t.nextGenerateAt  = nextRun;
      t.generatedCount  += 1;
      await t.save();

      generated++;
      console.log(`✅ Generated: "${title}" for ${t.clientId.name}`);
    }

    console.log(`🔁 Recurring cron done — ${generated} tasks generated`);
  } catch (err) {
    console.error('❌ Recurring cron error:', err.message);
  }
});

console.log('✅ Recurring tasks cron scheduled (daily 6AM)');
