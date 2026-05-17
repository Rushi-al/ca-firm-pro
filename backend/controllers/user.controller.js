const User = require('../models/User');
const Task = require('../models/Task');

// Get all employees in THIS firm only
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ firmId: req.firmId, role: { $in: ['Admin', 'Employee'] } }).sort({ name: 1 });
    res.json({ success: true, message: 'Users fetched.', data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// Create employee in THIS firm
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role = 'Employee' } = req.body;

    // Prevent creating another Owner
    if (role === 'Owner') {
      return res.status(400).json({ success: false, message: 'Cannot create another Owner.', data: null });
    }

    // Check email unique within this firm
    const exists = await User.findOne({ firmId: req.firmId, email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Email already exists in this firm.', data: null });
    }

    const user = await User.create({ firmId: req.firmId, name, email, password, role });
    res.status(201).json({
      success: true,
      message: 'Employee created.',
      data: { id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// Update employee (Admin/Owner can deactivate or change role)
exports.updateUser = async (req, res) => {
  try {
    const { name, role, isActive } = req.body;

    // Cannot change Owner's role
    const target = await User.findOne({ _id: req.params.id, firmId: req.firmId });
    if (!target) return res.status(404).json({ success: false, message: 'User not found.', data: null });
    if (target.role === 'Owner') return res.status(400).json({ success: false, message: 'Cannot modify Owner.', data: null });

    if (name)     target.name     = name;
    if (role)     target.role     = role;
    if (isActive !== undefined) target.isActive = isActive;
    await target.save({ validateBeforeSave: false });

    res.json({ success: true, message: 'User updated.', data: target });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// Delete employee in THIS firm — blocked if has active tasks
exports.deleteUser = async (req, res) => {
  try {
    const target = await User.findOne({ _id: req.params.id, firmId: req.firmId });
    if (!target) return res.status(404).json({ success: false, message: 'User not found.', data: null });
    if (target.role === 'Owner') return res.status(400).json({ success: false, message: 'Cannot delete the firm Owner.', data: null });

    const activeTasks = await Task.countDocuments({ assignedTo: req.params.id, firmId: req.firmId, status: { $ne: 'Completed' } });
    if (activeTasks > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete: ${activeTasks} active task(s) assigned.`, data: null });
    }

    await User.findOneAndDelete({ _id: req.params.id, firmId: req.firmId });
    res.json({ success: true, message: 'Employee deleted.', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};
