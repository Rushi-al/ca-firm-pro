const mongoose = require('mongoose');
const crypto   = require('crypto');

const refreshTokenSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    firmId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Firm', required: true },
    token:     { type: String, required: true, unique: true },
    expiresAt: { type: Date,   required: true },
    isRevoked: { type: Boolean, default: false },
    userAgent: { type: String },
    ip:        { type: String },
  },
  { timestamps: true }
);

// Auto-delete expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Generate a secure random token
refreshTokenSchema.statics.generate = function () {
  return crypto.randomBytes(64).toString('hex');
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
