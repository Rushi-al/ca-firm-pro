const Task       = require('../models/Task');
const Client     = require('../models/Client');
const User       = require('../models/User');
const TimeEntry  = require('../models/TimeEntry');
const IncomeTax  = require('../models/IncomeTax');
const GSTFiling  = require('../models/GSTFiling');
const mongoose   = require('mongoose');

const toObjId = id => new mongoose.Types.ObjectId(id.toString());

// ─────────────────────────────────────────────────────────
// @desc   Full firm analytics dashboard
// @route  GET /api/reports/overview?from=&to=
// ─────────────────────────────────────────────────────────
exports.overview = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fid  = req.firmId;
    const now  = new Date();
    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to)   dateFilter.$lte = new Date(to);
    const hasDate = Object.keys(dateFilter).length > 0;

    const taskQuery  = { firmId: fid, ...(hasDate ? { createdAt: dateFilter } : {}) };
    const timeQuery  = { firmId: fid, ...(hasDate ? { date: dateFilter } : {}) };

    // ── Parallel queries ──────────────────────────────────
    const [
      totalTasks, completedTasks, overdueTasks,
      totalClients, totalEmployees,
      timeAgg, tasksByPriority, tasksByEmployee,
      gstFiled, gstOverdue, itrFiled, itrOverdue,
      taskTrend,
    ] = await Promise.all([
      Task.countDocuments(taskQuery),
      Task.countDocuments({ ...taskQuery, status: 'Completed' }),
      Task.countDocuments({ firmId: fid, status: { $ne: 'Completed' }, deadline: { $lt: now } }),
      Client.countDocuments({ firmId: fid }),
      User.countDocuments({ firmId: fid, role: { $in: ['Admin','Employee'] } }),

      // Time summary
      TimeEntry.aggregate([
        { $match: { firmId: toObjId(fid), ...(hasDate ? { date: dateFilter } : {}) } },
        { $group: { _id: null, totalMins: { $sum: '$durationMins' }, billableMins: { $sum: { $cond: ['$isBillable','$durationMins',0] } }, totalBilled: { $sum: '$billedAmount' } } },
      ]),

      // Tasks by priority
      Task.aggregate([
        { $match: { firmId: toObjId(fid) } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),

      // Tasks per employee
      Task.aggregate([
        { $match: { firmId: toObjId(fid) } },
        { $group: { _id: '$assignedTo', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status','Completed'] }, 1, 0] } } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $project: { name: { $arrayElemAt: ['$user.name', 0] }, total: 1, done: 1 } },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]),

      // GST stats
      GSTFiling.countDocuments({ firmId: fid, status: 'filed'   }),
      GSTFiling.countDocuments({ firmId: fid, status: 'overdue' }),
      IncomeTax.countDocuments({ firmId: fid, status: 'filed'   }),
      IncomeTax.countDocuments({ firmId: fid, status: 'overdue' }),

      // Task completion trend (last 12 weeks)
      Task.aggregate([
        { $match: { firmId: toObjId(fid), status: 'Completed', updatedAt: { $gte: new Date(now.getTime() - 84 * 864e5) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const ts = timeAgg[0] || { totalMins: 0, billableMins: 0, totalBilled: 0 };

    res.json({
      success: true,
      message: 'Overview report.',
      data: {
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          overdue: overdueTasks,
          completionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
          byPriority:    Object.fromEntries(tasksByPriority.map(r => [r._id, r.count])),
          byEmployee:    tasksByEmployee,
        },
        time: {
          totalHours:    +(ts.totalMins / 60).toFixed(1),
          billableHours: +(ts.billableMins / 60).toFixed(1),
          totalBilled:   ts.totalBilled,
        },
        firm: { totalClients, totalEmployees },
        compliance: { gstFiled, gstOverdue, itrFiled, itrOverdue },
        trend: taskTrend,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Employee productivity report
// @route  GET /api/reports/productivity?from=&to=
// ─────────────────────────────────────────────────────────
exports.productivity = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fid = req.firmId;
    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to)   dateFilter.$lte = new Date(to);
    const hasDate = Object.keys(dateFilter).length > 0;

    const employees = await User.find({ firmId: fid, role: { $in: ['Admin','Employee'] } });

    const stats = await Promise.all(employees.map(async emp => {
      const tq = { firmId: fid, assignedTo: emp._id, ...(hasDate ? { createdAt: dateFilter } : {}) };
      const [total, done, overdue, timeData] = await Promise.all([
        Task.countDocuments(tq),
        Task.countDocuments({ ...tq, status: 'Completed' }),
        Task.countDocuments({ ...tq, status: { $ne: 'Completed' }, deadline: { $lt: new Date() } }),
        TimeEntry.aggregate([
          { $match: { firmId: toObjId(fid), userId: toObjId(emp._id), ...(hasDate ? { date: dateFilter } : {}) } },
          { $group: { _id: null, totalMins: { $sum: '$durationMins' }, billed: { $sum: '$billedAmount' } } },
        ]),
      ]);
      const td = timeData[0] || { totalMins: 0, billed: 0 };
      return {
        id:             emp._id,
        name:           emp.name,
        email:          emp.email,
        role:           emp.role,
        tasks:          { total, done, overdue, rate: total ? Math.round((done/total)*100) : 0 },
        time:           { hours: +(td.totalMins/60).toFixed(1), billed: td.billed },
      };
    }));

    res.json({ success: true, message: 'Productivity report.', data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Client-wise report
// @route  GET /api/reports/clients?from=&to=
// ─────────────────────────────────────────────────────────
exports.clientReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fid = req.firmId;
    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to)   dateFilter.$lte = new Date(to);
    const hasDate = Object.keys(dateFilter).length > 0;

    const clients = await Client.find({ firmId: fid }).sort({ name: 1 });

    const stats = await Promise.all(clients.map(async cl => {
      const tq = { firmId: fid, clientId: cl._id, ...(hasDate ? { createdAt: dateFilter } : {}) };
      const [total, done, gstFiled, itrFiled, timeData] = await Promise.all([
        Task.countDocuments(tq),
        Task.countDocuments({ ...tq, status: 'Completed' }),
        GSTFiling.countDocuments({ firmId: fid, clientId: cl._id, status: 'filed' }),
        IncomeTax.countDocuments({ firmId: fid, clientId: cl._id, status: 'filed' }),
        TimeEntry.aggregate([
          { $match: { firmId: toObjId(fid), clientId: toObjId(cl._id), ...(hasDate ? { date: dateFilter } : {}) } },
          { $group: { _id: null, totalMins: { $sum: '$durationMins' }, billed: { $sum: '$billedAmount' } } },
        ]),
      ]);
      const td = timeData[0] || { totalMins: 0, billed: 0 };
      return {
        id:      cl._id,
        name:    cl.name,
        contact: cl.contact,
        gst:     cl.gstNumber,
        tasks:   { total, done },
        compliance: { gstFiled, itrFiled },
        time:    { hours: +(td.totalMins/60).toFixed(1), billed: td.billed },
      };
    }));

    res.json({ success: true, message: 'Client report.', data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Export report as CSV (simple, no external library)
// @route  GET /api/reports/export?type=tasks|time|clients
// ─────────────────────────────────────────────────────────
exports.exportCSV = async (req, res) => {
  try {
    const { type = 'tasks', from, to } = req.query;
    const fid = req.firmId;
    let rows = [], headers = [];

    if (type === 'tasks') {
      const tasks = await Task.find({ firmId: fid })
        .populate('clientId',   'name')
        .populate('assignedTo', 'name')
        .sort({ createdAt: -1 });
      headers = ['Title','Client','Assigned To','Priority','Status','Deadline','Progress'];
      rows = tasks.map(t => [
        t.title, t.clientId?.name, t.assignedTo?.name,
        t.priority, t.status,
        new Date(t.deadline).toLocaleDateString('en-IN'),
        `${t.progress}%`,
      ]);
    }

    if (type === 'time') {
      const entries = await TimeEntry.find({ firmId: fid })
        .populate('taskId',   'title')
        .populate('clientId', 'name')
        .populate('userId',   'name')
        .sort({ date: -1 });
      headers = ['Date','Employee','Client','Task','Duration (mins)','Hours','Billable','Amount (₹)'];
      rows = entries.map(e => [
        new Date(e.date).toLocaleDateString('en-IN'),
        e.userId?.name, e.clientId?.name, e.taskId?.title,
        e.durationMins, (e.durationMins/60).toFixed(2),
        e.isBillable ? 'Yes' : 'No',
        e.billedAmount,
      ]);
    }

    if (type === 'clients') {
      const clients = await Client.find({ firmId: fid });
      headers = ['Name','Contact','GST Number','Notes','Created'];
      rows = clients.map(c => [
        c.name, c.contact, c.gstNumber || '', c.notes || '',
        new Date(c.createdAt).toLocaleDateString('en-IN'),
      ]);
    }

    // Build CSV string
    const escape = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
    const csv = [
      headers.map(escape).join(','),
      ...rows.map(r => r.map(escape).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};
