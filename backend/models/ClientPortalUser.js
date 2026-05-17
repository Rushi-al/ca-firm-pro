const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// Clients get their own login — completely separate from firm users
const clientPortalUserSchema = new mongoose.Schema(
  {
    firmId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Firm',   required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, unique: true },

    name:     { type: String, required: true },
    email:    { type: String, required: true, lowercase: true, unique: true },
    password: { type: String, required: true, select: false },
    phone:    { type: String },

    isActive:     { type: Boolean, default: true },
    lastLoginAt:  { type: Date },

    // What client can see
    canViewTasks:       { type: Boolean, default: true },
    canViewDocuments:   { type: Boolean, default: true },
    canUploadDocuments: { type: Boolean, default: false },
  },
  { timestamps: true }
);

clientPortalUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

clientPortalUserSchema.methods.comparePassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('ClientPortalUser', clientPortalUserSchema);
