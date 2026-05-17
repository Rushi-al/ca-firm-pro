const jwt          = require('jsonwebtoken');
const User         = require('../models/User');
const Firm         = require('../models/Firm');
const RefreshToken = require('../models/RefreshToken');
const TwoFactor    = require('../models/TwoFactor');

// ── Token helpers ──────────────────────────────────────────
const signAccess = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' }); // Short-lived

const signRefresh = () => RefreshToken.generate();

// ── Cookie options ─────────────────────────────────────────
const COOKIE_OPTS = {
  httpOnly: true,                       // Not accessible via JS — XSS safe
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   30 * 24 * 60 * 60 * 1000,  // 30 days
};

// ── Password strength validator ────────────────────────────
// Min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
const isStrongPassword = (pw) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(pw);

// ─────────────────────────────────────────────────────────
// @desc   Login with httpOnly cookie + refresh token
// @route  POST /api/auth/login
// ─────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.', data: null });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.', data: null });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated. Contact your admin.', data: null });
    }

    const firm = await Firm.findById(user.firmId);
    if (!firm?.isActive) {
      return res.status(403).json({ success: false, message: 'Firm account suspended.', data: null });
    }

    // Check if 2FA is enabled
    const tf = await TwoFactor.findOne({ userId: user._id, isEnabled: true });
    if (tf) {
      // Return a temp token — front-end must complete 2FA step
      const tempToken = jwt.sign({ id: user._id, step: '2fa' }, process.env.JWT_SECRET, { expiresIn: '5m' });
      return res.json({
        success: true,
        message: '2FA required.',
        data: { requires2FA: true, tempToken, userId: user._id },
      });
    }

    // Issue access token (short-lived)
    const accessToken  = signAccess(user._id);

    // Issue refresh token (long-lived, stored in DB + httpOnly cookie)
    const rawRefresh   = signRefresh();
    const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await RefreshToken.create({
      userId:    user._id,
      firmId:    user.firmId,
      token:     rawRefresh,
      expiresAt,
      userAgent: req.headers['user-agent'],
      ip:        req.ip,
    });

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', rawRefresh, COOKIE_OPTS);

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        accessToken,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
        firm: { id: firm._id, name: firm.name, slug: firm.slug, plan: firm.plan },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Complete login after 2FA verification
// @route  POST /api/auth/2fa/complete
// @body   { tempToken, token (OTP) }
// ─────────────────────────────────────────────────────────
exports.complete2FA = async (req, res) => {
  try {
    const { tempToken, token } = req.body;
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (decoded.step !== '2fa') return res.status(400).json({ success: false, message: 'Invalid token.', data: null });

    const tf = await TwoFactor.findOne({ userId: decoded.id, isEnabled: true });
    if (!tf) return res.status(400).json({ success: false, message: '2FA not found.', data: null });

    const { verifyTOTP } = require('./twofactor.controller');
    if (!verifyTOTP(tf.secret, token)) {
      // Check backup codes
      const backup = tf.backupCodes.find(b => !b.isUsed && b.code === token.toUpperCase());
      if (!backup) return res.status(400).json({ success: false, message: 'Invalid 2FA code.', data: null });
      backup.isUsed = true; backup.usedAt = new Date();
      await tf.save();
    }

    const user = await User.findById(decoded.id);
    const firm = await Firm.findById(user.firmId);

    const accessToken = signAccess(user._id);
    const rawRefresh  = signRefresh();
    await RefreshToken.create({
      userId:    user._id, firmId: user.firmId,
      token:     rawRefresh,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: req.headers['user-agent'], ip: req.ip,
    });
    res.cookie('refreshToken', rawRefresh, COOKIE_OPTS);

    res.json({
      success: true, message: '2FA verified. Login successful.',
      data: {
        accessToken,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
        firm: { id: firm._id, name: firm.name, plan: firm.plan },
      },
    });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Token expired. Please log in again.', data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Refresh access token
// @route  POST /api/auth/refresh
// ─────────────────────────────────────────────────────────
exports.refresh = async (req, res) => {
  try {
    const raw = req.cookies?.refreshToken;
    if (!raw) return res.status(401).json({ success: false, message: 'No refresh token.', data: null });

    const stored = await RefreshToken.findOne({ token: raw, isRevoked: false });
    if (!stored || stored.expiresAt < new Date()) {
      res.clearCookie('refreshToken');
      return res.status(401).json({ success: false, message: 'Refresh token expired. Please log in.', data: null });
    }

    // Rotate: revoke old, issue new
    stored.isRevoked = true;
    await stored.save();

    const newRaw = signRefresh();
    await RefreshToken.create({
      userId:    stored.userId, firmId: stored.firmId,
      token:     newRaw,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: req.headers['user-agent'], ip: req.ip,
    });
    res.cookie('refreshToken', newRaw, COOKIE_OPTS);

    const accessToken = signAccess(stored.userId);
    res.json({ success: true, message: 'Token refreshed.', data: { accessToken } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Logout — revoke refresh token + clear cookie
// @route  POST /api/auth/logout
// ─────────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    const raw = req.cookies?.refreshToken;
    if (raw) {
      await RefreshToken.findOneAndUpdate({ token: raw }, { isRevoked: true });
    }
    res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    res.json({ success: true, message: 'Logged out.', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Change password with strength check
// @route  PUT /api/auth/change-password
// ─────────────────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number.',
        data: null,
      });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.', data: null });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed.', data: null });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Get current user
// @route  GET /api/auth/me
// ─────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const firm = await Firm.findById(req.user.firmId);
    const tf   = await TwoFactor.findOne({ userId: req.user._id });
    res.json({
      success: true,
      message: 'User fetched.',
      data: {
        user: { ...req.user.toJSON(), twoFactorEnabled: tf?.isEnabled || false },
        firm: firm ? { id: firm._id, name: firm.name, plan: firm.plan } : null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

exports.isStrongPassword = isStrongPassword;
