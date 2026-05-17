const express = require('express');
const r = express.Router();
const c = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
r.post('/login',           c.login);
r.get('/me',               protect, c.getMe);
r.put('/change-password',  protect, c.changePassword);
module.exports = r;
