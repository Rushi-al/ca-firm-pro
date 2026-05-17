const Task        = require('../models/Task');
const ActivityLog = require('../models/ActivityLog');

exports.getTasks = async (req, res) => {
  try {
    const { status, priority, assignedTo, clientId, page = 1, limit = 100 } = req.query;

    // Base query ALWAYS includes firmId
    const query = { firmId: req.firmId };

    if (['Employee', 'Admin'].includes(req.user.role)) query.assignedTo = req.user._id;
    else if (assignedTo) query.assignedTo = assignedTo;

    if (status && status !== 'Overdue') query.status = status;
    if (priority)  query.priority  = priority;
    if (clientId)  query.clientId  = clientId;

    let tasks = await Task.find(query)
      .populate('clientId',   'name contact')
      .populate('assignedTo', 'name email')
      .sort({ deadline: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    if (status === 'Overdue') {
      tasks = tasks.filter(t => t.status !== 'Completed' && new Date(t.deadline) < new Date(new Date().toDateString()));
    }

    const total = await Task.countDocuments(query);
    res.json({ success: true, message: 'Tasks fetched.', data: { tasks, total, page: Number(page) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

exports.getTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, firmId: req.firmId })
      .populate('clientId',   'name contact gstNumber')
      .populate('assignedTo', 'name email');
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.', data: null });
    if (req.user.role === 'Employee' && task.assignedTo._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.', data: null });
    }
    res.json({ success: true, message: 'Task fetched.', data: task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

exports.createTask = async (req, res) => {
  try {
    const task = await Task.create({ ...req.body, firmId: req.firmId, createdBy: req.user._id });
    await ActivityLog.create({ firmId: req.firmId, userId: req.user._id, action: `Created task: "${task.title}"`, taskId: task._id });
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'task' }); } catch (e) {}
    const populated = await task.populate(['clientId', 'assignedTo']);
    res.status(201).json({ success: true, message: 'Task created.', data: populated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, firmId: req.firmId });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.', data: null });

    if (req.user.role === 'Employee') {
      if (task.assignedTo.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to edit this task.', data: null });
      }
      const { progress, notes } = req.body;
      if (progress !== undefined) task.progress = progress;
      if (notes    !== undefined) task.notes    = notes;
    } else {
      Object.assign(task, req.body);
    }

    await task.save();
    await ActivityLog.create({ firmId: req.firmId, userId: req.user._id, action: `Updated task: "${task.title}" — ${task.progress}% (${task.status})`, taskId: task._id });
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'task' }); } catch (e) {}
    const populated = await task.populate(['clientId', 'assignedTo']);
    res.json({ success: true, message: 'Task updated.', data: populated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, firmId: req.firmId });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.', data: null });
    if (task.status !== 'Completed') {
      return res.status(400).json({ success: false, message: 'Only completed tasks can be deleted.', data: null });
    }
    await task.deleteOne();
    await ActivityLog.create({ firmId: req.firmId, userId: req.user._id, action: `Deleted task: "${task.title}"` });
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'task' }); } catch (e) {}
    res.json({ success: true, message: 'Task deleted.', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

exports.getStats = async (req, res) => {
  try {
    const today = new Date(new Date().toDateString());
    const base  = { firmId: req.firmId };
    const [total, completed, inProgress, notStarted, overdue] = await Promise.all([
      Task.countDocuments(base),
      Task.countDocuments({ ...base, status: 'Completed' }),
      Task.countDocuments({ ...base, status: 'In Progress' }),
      Task.countDocuments({ ...base, status: 'Not Started' }),
      Task.countDocuments({ ...base, status: { $ne: 'Completed' }, deadline: { $lt: today } }),
    ]);
    res.json({ success: true, message: 'Stats fetched.', data: { total, completed, inProgress, notStarted, overdue } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};
