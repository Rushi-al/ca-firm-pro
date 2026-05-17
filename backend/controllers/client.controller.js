const Client      = require('../models/Client');
const Task        = require('../models/Task');
const ActivityLog = require('../models/ActivityLog');

// Every query uses { firmId: req.firmId, ... } — data isolation guaranteed

exports.getClients = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const query = { firmId: req.firmId };
    if (search) query.name = { $regex: search, $options: 'i' };

    const total   = await Client.countDocuments(query);
    const clients = await Client.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, message: 'Clients fetched.', data: { clients, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

exports.getClient = async (req, res) => {
  try {
    // firmId filter prevents cross-firm data access
    const client = await Client.findOne({ _id: req.params.id, firmId: req.firmId });
    if (!client) return res.status(404).json({ success: false, message: 'Client not found.', data: null });
    res.json({ success: true, message: 'Client fetched.', data: client });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};

exports.createClient = async (req, res) => {
  try {
    const client = await Client.create({ ...req.body, firmId: req.firmId, createdBy: req.user._id });
    await ActivityLog.create({ firmId: req.firmId, userId: req.user._id, action: `Added client: ${client.name}`, clientId: client._id });
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'client' }); } catch (e) {}
    res.status(201).json({ success: true, message: 'Client created.', data: client });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, firmId: req.firmId },   // firmId in query = isolation
      req.body,
      { new: true, runValidators: true }
    );
    if (!client) return res.status(404).json({ success: false, message: 'Client not found.', data: null });
    await ActivityLog.create({ firmId: req.firmId, userId: req.user._id, action: `Updated client: ${client.name}`, clientId: client._id });
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'client' }); } catch (e) {}
    res.json({ success: true, message: 'Client updated.', data: client });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message, data: null });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    // Check only THIS firm's active tasks
    const activeTasks = await Task.countDocuments({ clientId: req.params.id, firmId: req.firmId, status: { $ne: 'Completed' } });
    if (activeTasks > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete: ${activeTasks} active task(s) exist for this client.`, data: null });
    }
    const client = await Client.findOneAndDelete({ _id: req.params.id, firmId: req.firmId });
    if (!client) return res.status(404).json({ success: false, message: 'Client not found.', data: null });
    await ActivityLog.create({ firmId: req.firmId, userId: req.user._id, action: `Deleted client: ${client.name}` });
    try { require('../socket').getIO().to(req.firmId.toString()).emit('firm_data_updated', { type: 'client' }); } catch (e) {}
    res.json({ success: true, message: 'Client deleted.', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
};
