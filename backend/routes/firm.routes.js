// routes/firm.routes.js
const express = require('express');
const r = express.Router();
const c = require('../controllers/firm.controller');
const { protect, tenantGuard, authorize } = require('../middleware/auth.middleware');
r.post('/register', c.registerFirm);
r.get('/all',       c.getAllFirms);
r.get('/me',        protect, tenantGuard, c.getMyFirm);
r.put('/me',        protect, tenantGuard, authorize('Owner'), c.updateFirm);
module.exports = r;
