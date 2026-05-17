const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const Firm = require('../models/Firm');

// ── Verify short-lived JWT access token ───────────────────
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized. Please log in.', data: null });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Reject temp 2FA tokens
    if (decoded.step === '2fa') {
      return res.status(401).json({ success: false, message: 'Complete 2FA verification first.', data: null });
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.', data: null });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Access token expired. Please refresh.', data: { tokenExpired: true } });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.', data: null });
  }
};

// ── Tenant guard ───────────────────────────────────────────
exports.tenantGuard = async (req, res, next) => {
  try {
    const firm = await Firm.findById(req.user.firmId);
    if (!firm || !firm.isActive) {
      return res.status(403).json({ success: false, message: 'Firm account suspended.', data: null });
    }
    req.firm   = firm;
    req.firmId = firm._id;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ── Role authorization ─────────────────────────────────────
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' is not authorized for this action.`,
      data: null,
    });
  }
  next();
};

// ── Plan limit checker ─────────────────────────────────────
exports.checkPlanLimit = (resource) => async (req, res, next) => {
  try {
    const limits = req.firm.getLimits();
    if (resource === 'employees') {
      const count = await require('../models/User').countDocuments({ firmId: req.firmId, role: { $in: ['Admin','Employee'] } });
      if (count >= limits.employees) {
        return res.status(403).json({ success: false, message: `Your ${req.firm.plan} plan allows max ${limits.employees} employees. Please upgrade.`, data: { limit: limits.employees, current: count, plan: req.firm.plan } });
      }
    }
    if (resource === 'clients') {
      const count = await require('../models/Client').countDocuments({ firmId: req.firmId });
      if (count >= limits.clients) {
        return res.status(403).json({ success: false, message: `Your ${req.firm.plan} plan allows max ${limits.clients} clients. Please upgrade.`, data: { limit: limits.clients, current: count, plan: req.firm.plan } });
      }
    }
    next();
  } catch (err) { next(err); }
};
