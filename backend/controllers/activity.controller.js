const ActivityLog = require('../models/ActivityLog');

exports.getLogs = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const logs = await ActivityLog.find({ firmId: req.firmId })
      .populate('userId',   'name role')
      .populate('taskId',   'title')
      .populate('clientId', 'name')
      .sort({ createdAt: -1 })
      .limit(Number(limit));
    res.json({ success: true, message: 'Logs fetched.', data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};
