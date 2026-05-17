const jwt              = require('jsonwebtoken');
const ClientPortalUser = require('../models/ClientPortalUser');
const Task             = require('../models/Task');
const Attachment       = require('../models/Attachment');
const GSTFiling        = require('../models/GSTFiling');
const Client           = require('../models/Client');
const { getSignedDownloadUrl } = require('../middleware/upload.middleware');

const signClientToken = (id) =>
  jwt.sign({ id, type: 'client' }, process.env.CLIENT_JWT_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.CLIENT_JWT_EXPIRES_IN || '30d',
  });

// ── Client Portal Auth middleware ─────────────────────────
exports.clientProtect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ success: false, message: 'Not authorized.', data: null });

    const decoded = jwt.verify(token, process.env.CLIENT_JWT_SECRET || process.env.JWT_SECRET);
    if (decoded.type !== 'client') return res.status(401).json({ success: false, message: 'Invalid token type.', data: null });

    const portalUser = await ClientPortalUser.findById(decoded.id);
    if (!portalUser || !portalUser.isActive) {
      return res.status(401).json({ success: false, message: 'Access revoked.', data: null });
    }

    req.portalUser = portalUser;
    req.clientId   = portalUser.clientId;
    req.firmId     = portalUser.firmId;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token.', data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Create portal access for a client (Admin action)
// @route  POST /api/portal/create-access
// ─────────────────────────────────────────────────────────
exports.createAccess = async (req, res) => {
  try {
    const { clientId, name, email, password, canUploadDocuments } = req.body;

    // Verify client belongs to firm
    const client = await Client.findOne({ _id: clientId, firmId: req.firmId });
    if (!client) return res.status(404).json({ success: false, message: 'Client not found.', data: null });

    const existing = await ClientPortalUser.findOne({ clientId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Portal access already exists for this client.', data: null });
    }

    const portalUser = await ClientPortalUser.create({
      firmId:             req.firmId,
      clientId,
      name,
      email,
      password,
      canUploadDocuments: canUploadDocuments || false,
    });

    res.status(201).json({
      success: true,
      message: `Portal access created for ${client.name}. Share login: ${email}`,
      data: { id: portalUser._id, email: portalUser.email, clientName: client.name },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Client portal login
// @route  POST /api/portal/login
// ─────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const portalUser = await ClientPortalUser.findOne({ email: email.toLowerCase() }).select('+password');

    if (!portalUser || !(await portalUser.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.', data: null });
    }
    if (!portalUser.isActive) {
      return res.status(403).json({ success: false, message: 'Portal access has been revoked.', data: null });
    }

    portalUser.lastLoginAt = new Date();
    await portalUser.save({ validateBeforeSave: false });

    const client = await Client.findById(portalUser.clientId);
    const token  = signClientToken(portalUser._id);

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        client:     { id: client._id, name: client.name },
        portalUser: { id: portalUser._id, name: portalUser.name, email: portalUser.email },
        permissions: {
          canViewTasks:       portalUser.canViewTasks,
          canViewDocuments:   portalUser.canViewDocuments,
          canUploadDocuments: portalUser.canUploadDocuments,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Client: view their own tasks
// @route  GET /api/portal/tasks
// ─────────────────────────────────────────────────────────
exports.getMyTasks = async (req, res) => {
  try {
    if (!req.portalUser.canViewTasks) {
      return res.status(403).json({ success: false, message: 'Task access not enabled.', data: null });
    }
    const tasks = await Task.find({ clientId: req.clientId, firmId: req.firmId })
      .select('title status priority deadline progress notes createdAt')
      .sort({ deadline: 1 });

    res.json({ success: true, message: 'Tasks fetched.', data: tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Client: view their GST filings
// @route  GET /api/portal/gst
// ─────────────────────────────────────────────────────────
exports.getMyGSTFilings = async (req, res) => {
  try {
    const filings = await GSTFiling.find({ clientId: req.clientId, firmId: req.firmId })
      .select('returnType period dueDate filedDate status')
      .sort({ dueDate: -1 });
    res.json({ success: true, message: 'GST filings fetched.', data: filings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

// ─────────────────────────────────────────────────────────
// @desc   Client: view documents shared with them
// @route  GET /api/portal/documents
// ─────────────────────────────────────────────────────────
exports.getMyDocuments = async (req, res) => {
  try {
    if (!req.portalUser.canViewDocuments) {
      return res.status(403).json({ success: false, message: 'Document access not enabled.', data: null });
    }

    // Get all tasks for this client, then their attachments
    const tasks = await Task.find({ clientId: req.clientId, firmId: req.firmId }).select('_id title');
    const taskIds = tasks.map(t => t._id);

    const attachments = await Attachment.find({ taskId: { $in: taskIds }, isDeleted: false })
      .populate('taskId', 'title')
      .sort({ createdAt: -1 });

    // Generate signed URLs
    const withUrls = await Promise.all(
      attachments.map(async a => {
        let downloadUrl;
        try {
          downloadUrl = process.env.AWS_ACCESS_KEY_ID
            ? await getSignedDownloadUrl(a.s3Key)
            : `/uploads/${a.s3Key}`;
        } catch { downloadUrl = null; }
        return {
          id:           a._id,
          name:         a.originalName,
          size:         a.sizeBytes,
          mimeType:     a.mimeType,
          uploadedAt:   a.createdAt,
          taskTitle:    a.taskId?.title,
          downloadUrl,
        };
      })
    );

    res.json({ success: true, message: 'Documents fetched.', data: withUrls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};
