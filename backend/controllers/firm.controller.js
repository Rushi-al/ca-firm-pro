const Firm = require('../models/Firm');
const User = require('../models/User');
const jwt  = require('jsonwebtoken');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// ─────────────────────────────────────────────────────────
// @desc   Register a NEW firm + create Owner account
// @route  POST /api/firms/register
// @access Public
// ─────────────────────────────────────────────────────────
exports.registerFirm = async (req, res) => {
  try {
    const { firmName, ownerName, ownerEmail, password, phone, address } = req.body;

    // Validate required fields
    if (!firmName || !ownerName || !ownerEmail || !password) {
      return res.status(400).json({ success: false, message: 'firmName, ownerName, ownerEmail and password are required.', data: null });
    }

    // Check if this email is already an Owner of some firm
    const existingOwner = await User.findOne({ email: ownerEmail, role: 'Owner' });
    if (existingOwner) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.', data: null });
    }

    // 1. Create the Firm
    const firm = await Firm.create({ name: firmName, ownerEmail, phone, address });

    // 2. Create the Owner user under this firm
    const owner = await User.create({
      firmId:   firm._id,
      name:     ownerName,
      email:    ownerEmail,
      password: password,
      role:     'Owner',
    });

    const token = signToken(owner._id);
    res.status(201).json({
      success: true,
      message: `Welcome to CA Firm Pro! Your firm "${firm.name}" is ready.`,
      data: {
        token,
        user: { id: owner._id, name: owner.name, email: owner.email, role: owner.role },
        firm: { id: firm._id, name: firm.name, slug: firm.slug, plan: firm.plan },
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Get current firm details
// @route  GET /api/firms/me
// @access Owner, Admin
// ─────────────────────────────────────────────────────────
exports.getMyFirm = async (req, res) => {
  try {
    const firm = await Firm.findById(req.firmId);

    // Get usage stats
    const [employeeCount, clientCount, taskCount] = await Promise.all([
      User.countDocuments({ firmId: req.firmId, role: { $in: ['Admin', 'Employee'] } }),
      require('../models/Client').countDocuments({ firmId: req.firmId }),
      require('../models/Task').countDocuments({ firmId: req.firmId }),
    ]);

    const limits = firm.getLimits();

    res.json({
      success: true,
      message: 'Firm details fetched.',
      data: {
        firm,
        usage: { employees: employeeCount, clients: clientCount, tasks: taskCount },
        limits,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Update firm settings
// @route  PUT /api/firms/me
// @access Owner only
// ─────────────────────────────────────────────────────────
exports.updateFirm = async (req, res) => {
  try {
    const { name, phone, address, gstin, logoUrl } = req.body;
    const firm = await Firm.findByIdAndUpdate(
      req.firmId,
      { name, phone, address, gstin, logoUrl },
      { new: true, runValidators: true }
    );
    res.json({ success: true, message: 'Firm updated.', data: firm });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Get all firms (Super Admin / platform view)
// @route  GET /api/firms
// @access Internal - no JWT (protected by separate secret header)
// ─────────────────────────────────────────────────────────
exports.getAllFirms = async (req, res) => {
  try {
    // Simple security: require a secret header for now
    if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ success: false, message: 'Forbidden.', data: null });
    }
    const firms = await Firm.find().sort({ createdAt: -1 });
    res.json({ success: true, message: 'All firms.', data: firms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};
