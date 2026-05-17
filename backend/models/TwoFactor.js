const mongoose = require('mongoose');

const twoFactorSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    secret:     { type: String, required: true },      // Base32 TOTP secret
    isEnabled:  { type: Boolean, default: false },
    // Backup codes (one-time use)
    backupCodes: [{
      code:    { type: String },
      usedAt:  { type: Date },
      isUsed:  { type: Boolean, default: false },
    }],
    enabledAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TwoFactor', twoFactorSchema);
