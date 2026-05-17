const Notification = require('../models/Notification');

// @desc   Get notifications for current user
// @route  GET /api/notifications?unreadOnly=true&limit=20
exports.getAll = async (req, res) => {
  try {
    const { unreadOnly, limit = 20, page = 1 } = req.query;
    const query = { firmId: req.firmId, userId: req.user._id };
    if (unreadOnly === 'true') query.isRead = false;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Notification.countDocuments({ firmId: req.firmId, userId: req.user._id, isRead: false }),
    ]);

    res.json({ success: true, message: 'Notifications fetched.', data: { notifications, unreadCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// @desc   Get unread count only (for badge)
// @route  GET /api/notifications/count
exports.getCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      firmId: req.firmId,
      userId: req.user._id,
      isRead: false,
    });
    res.json({ success: true, message: 'Count fetched.', data: { count } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// @desc   Mark one notification as read
// @route  PUT /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true, readAt: new Date() }
    );
    res.json({ success: true, message: 'Marked as read.', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// @desc   Mark ALL as read
// @route  PUT /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { firmId: req.firmId, userId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.json({ success: true, message: 'All marked as read.', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// @desc   Delete a notification
// @route  DELETE /api/notifications/:id
exports.remove = async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true, message: 'Notification deleted.', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};
