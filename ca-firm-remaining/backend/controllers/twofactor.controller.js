const crypto    = require('crypto');
const TwoFactor = require('../models/TwoFactor');
const User      = require('../models/User');

// Simple TOTP implementation (no external library needed)
// RFC 6238 — Time-based One-Time Password

const base32Encode = (buf) => {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0, value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += CHARS[(value << (5 - bits)) & 31];
  return result;
};

const base32Decode = (str) => {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  str = str.toUpperCase().replace(/=+$/, '');
  const buf = Buffer.alloc(Math.floor(str.length * 5 / 8));
  let bits = 0, value = 0, idx = 0;
  for (const c of str) {
    value = (value << 5) | CHARS.indexOf(c);
    bits += 5;
    if (bits >= 8) { buf[idx++] = (value >>> (bits - 8)) & 255; bits -= 8; }
  }
  return buf;
};

const generateTOTP = (secret, timeStep = 30) => {
  const time    = Math.floor(Date.now() / 1000 / timeStep);
  const timeBuf = Buffer.alloc(8);
  timeBuf.writeUInt32BE(Math.floor(time / 0x100000000), 0);
  timeBuf.writeUInt32BE(time & 0xffffffff, 4);
  const key  = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(timeBuf).digest();
  const off  = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[off] & 0x7f) << 24 | hmac[off+1] << 16 | hmac[off+2] << 8 | hmac[off+3]) % 1000000;
  return String(code).padStart(6, '0');
};

const verifyTOTP = (secret, token) => {
  // Allow ±1 time step for clock drift
  for (const delta of [-1, 0, 1]) {
    const time    = Math.floor(Date.now() / 1000 / 30) + delta;
    const timeBuf = Buffer.alloc(8);
    timeBuf.writeUInt32BE(Math.floor(time / 0x100000000), 0);
    timeBuf.writeUInt32BE(time & 0xffffffff, 4);
    const key  = base32Decode(secret);
    const hmac = crypto.createHmac('sha1', key).update(timeBuf).digest();
    const off  = hmac[hmac.length - 1] & 0x0f;
    const code = ((hmac[off] & 0x7f) << 24 | hmac[off+1] << 16 | hmac[off+2] << 8 | hmac[off+3]) % 1000000;
    if (String(code).padStart(6, '0') === token) return true;
  }
  return false;
};

// Generate backup codes
const genBackupCodes = () =>
  Array.from({ length: 8 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());

// ─────────────────────────────────────────────────────────
// @desc   Setup 2FA — generate secret + QR URL
// @route  POST /api/auth/2fa/setup
// ─────────────────────────────────────────────────────────
exports.setup = async (req, res) => {
  try {
    const user   = req.user;
    const secret = base32Encode(crypto.randomBytes(20));

    // Store secret (not enabled yet — user must verify first)
    await TwoFactor.findOneAndUpdate(
      { userId: user._id },
      { userId: user._id, secret, isEnabled: false },
      { upsert: true, new: true }
    );

    // Build otpauth URL for QR code
    const issuer  = 'CA Firm Pro';
    const account = encodeURIComponent(user.email);
    const otpUrl  = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

    res.json({
      success: true,
      message: 'Scan this QR code with Google Authenticator.',
      data: { secret, otpUrl },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Enable 2FA after user scans + verifies
// @route  POST /api/auth/2fa/enable
// @body   { token: "123456" }
// ─────────────────────────────────────────────────────────
exports.enable = async (req, res) => {
  try {
    const { token } = req.body;
    const tf = await TwoFactor.findOne({ userId: req.user._id });
    if (!tf) return res.status(400).json({ success: false, message: 'Run setup first.', data: null });

    if (!verifyTOTP(tf.secret, token)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Try again.', data: null });
    }

    const backupCodes = genBackupCodes();
    tf.isEnabled  = true;
    tf.enabledAt  = new Date();
    tf.backupCodes = backupCodes.map(code => ({ code, isUsed: false }));
    await tf.save();

    // Mark user as 2FA-enabled
    await User.findByIdAndUpdate(req.user._id, { twoFactorEnabled: true });

    res.json({
      success: true,
      message: '2FA enabled. Save your backup codes — they cannot be shown again.',
      data: { backupCodes },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Disable 2FA
// @route  POST /api/auth/2fa/disable
// @body   { token: "123456" }
// ─────────────────────────────────────────────────────────
exports.disable = async (req, res) => {
  try {
    const { token } = req.body;
    const tf = await TwoFactor.findOne({ userId: req.user._id });
    if (!tf?.isEnabled) return res.status(400).json({ success: false, message: '2FA is not enabled.', data: null });

    if (!verifyTOTP(tf.secret, token)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.', data: null });
    }

    tf.isEnabled = false;
    await tf.save();
    await User.findByIdAndUpdate(req.user._id, { twoFactorEnabled: false });

    res.json({ success: true, message: '2FA disabled.', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Verify 2FA token during login (step 2)
// @route  POST /api/auth/2fa/verify
// @body   { userId, token }
// ─────────────────────────────────────────────────────────
exports.verify = async (req, res) => {
  try {
    const { userId, token } = req.body;
    const tf = await TwoFactor.findOne({ userId, isEnabled: true });
    if (!tf) return res.status(400).json({ success: false, message: '2FA not set up.', data: null });

    // Check TOTP
    if (verifyTOTP(tf.secret, token)) {
      return res.json({ success: true, message: '2FA verified.', data: { verified: true } });
    }

    // Check backup codes
    const backup = tf.backupCodes.find(b => !b.isUsed && b.code === token.toUpperCase());
    if (backup) {
      backup.isUsed = true;
      backup.usedAt = new Date();
      await tf.save();
      return res.json({ success: true, message: 'Backup code used.', data: { verified: true, usedBackupCode: true } });
    }

    return res.status(400).json({ success: false, message: 'Invalid 2FA code.', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// Export verifyTOTP for use in auth middleware
exports.verifyTOTP = verifyTOTP;
