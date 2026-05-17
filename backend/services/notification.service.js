const Notification = require('../models/Notification');

// ── Create a single notification ──────────────────────────
exports.create = async ({ firmId, userId, type, title, message, taskId, clientId, link }) => {
  try {
    return await Notification.create({ firmId, userId, type, title, message, taskId, clientId, link });
  } catch (err) {
    console.error('Notification create error:', err.message);
  }
};

// ── Notify multiple users at once ─────────────────────────
exports.createBulk = async (notifications) => {
  try {
    return await Notification.insertMany(notifications, { ordered: false });
  } catch (err) {
    console.error('Bulk notification error:', err.message);
  }
};

// ── Task assigned notification ────────────────────────────
exports.taskAssigned = async ({ firmId, assignedTo, taskTitle, clientName, taskId }) => {
  await exports.create({
    firmId, userId: assignedTo,
    type:    'task_assigned',
    title:   'New Task Assigned',
    message: `You have been assigned: "${taskTitle}" for ${clientName}`,
    taskId,
    link:    '/tasks',
  });
};

// ── Task completed notification (to all admins) ───────────
exports.taskCompleted = async ({ firmId, adminIds, employeeName, taskTitle, clientName, taskId }) => {
  const notes = adminIds.map(uid => ({
    firmId, userId: uid,
    type:    'task_completed',
    title:   'Task Completed',
    message: `${employeeName} completed: "${taskTitle}" for ${clientName}`,
    taskId,
    link:    '/tasks',
  }));
  await exports.createBulk(notes);
};

// ── GST deadline warning ──────────────────────────────────
exports.gstDeadline = async ({ firmId, userIds, returnType, clientName, daysLeft, filingId }) => {
  const notes = userIds.map(uid => ({
    firmId, userId: uid,
    type:    'gst_deadline',
    title:   `GST Deadline: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`,
    message: `${returnType} for ${clientName} is due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    link:    '/gst',
  }));
  await exports.createBulk(notes);
};

// ── ITR deadline warning ──────────────────────────────────
exports.itrDeadline = async ({ firmId, userIds, itrForm, clientName, daysLeft }) => {
  const notes = userIds.map(uid => ({
    firmId, userId: uid,
    type:    'itr_deadline',
    title:   `ITR Deadline: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`,
    message: `${itrForm} for ${clientName} is due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    link:    '/itr',
  }));
  await exports.createBulk(notes);
};

// ── Time entry approved/rejected ──────────────────────────
exports.timeApproval = async ({ firmId, userId, action, taskTitle }) => {
  await exports.create({
    firmId, userId,
    type:    action === 'approve' ? 'time_approved' : 'time_rejected',
    title:   `Time Entry ${action === 'approve' ? 'Approved' : 'Rejected'}`,
    message: `Your time log for "${taskTitle}" was ${action === 'approve' ? 'approved ✓' : 'rejected ✕'}`,
    link:    '/time',
  });
};

// ── Plan expiring ─────────────────────────────────────────
exports.planExpiring = async ({ firmId, ownerId, daysLeft }) => {
  await exports.create({
    firmId, userId: ownerId,
    type:    'plan_expiring',
    title:   `Plan expires in ${daysLeft} days`,
    message: `Your subscription will expire in ${daysLeft} days. Renew to keep access.`,
    link:    '/billing',
  });
};
