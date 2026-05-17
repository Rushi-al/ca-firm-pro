const express = require('express');
const { protect, tenantGuard, authorize } = require('../middleware/auth.middleware');

// ── Notification routes ────────────────────────────────────
const notifCtrl  = require('../controllers/notification.controller');
const notifRouter = express.Router();
notifRouter.use(protect, tenantGuard);
notifRouter.get('/count',      notifCtrl.getCount);
notifRouter.get('/',           notifCtrl.getAll);
notifRouter.put('/read-all',   notifCtrl.markAllRead);
notifRouter.put('/:id/read',   notifCtrl.markRead);
notifRouter.delete('/:id',     notifCtrl.remove);
module.exports.notifRouter = notifRouter;

// ── 2FA routes ─────────────────────────────────────────────
const tfCtrl  = require('../controllers/twofactor.controller');
const tfRouter = express.Router();
tfRouter.post('/setup',    protect, tfCtrl.setup);
tfRouter.post('/enable',   protect, tfCtrl.enable);
tfRouter.post('/disable',  protect, tfCtrl.disable);
tfRouter.post('/verify',   tfCtrl.verify);           // Public — used during login
module.exports.tfRouter = tfRouter;

// ── PDF routes ─────────────────────────────────────────────
const pdfCtrl  = require('../controllers/pdf.controller');
const pdfRouter = express.Router();
pdfRouter.use(protect, tenantGuard, authorize('Owner','Admin'));
pdfRouter.get('/tasks',           pdfCtrl.taskReport);
pdfRouter.get('/client/:clientId', pdfCtrl.clientSummary);
module.exports.pdfRouter = pdfRouter;

// ── Sign-off routes ────────────────────────────────────────
const signCtrl   = require('../controllers/signoff.controller');
const { clientProtect } = require('../controllers/portal.controller');

// Admin requests sign-off
const signAdminRouter = express.Router();
signAdminRouter.post('/:taskId/request-signoff', protect, tenantGuard, authorize('Owner','Admin'), signCtrl.requestSignOff);
module.exports.signAdminRouter = signAdminRouter;

// Client portal sign-off
const signPortalRouter = express.Router();
signPortalRouter.get('/pending-signoff',          clientProtect, signCtrl.getPendingSignOff);
signPortalRouter.put('/:taskId/signoff',          clientProtect, signCtrl.clientSignOff);
module.exports.signPortalRouter = signPortalRouter;

// ── Updated auth routes (with refresh token + 2FA complete) ─
const authCtrl  = require('../controllers/auth.controller');
const authRouter = express.Router();
authRouter.post('/login',           authCtrl.login);
authRouter.post('/logout',          authCtrl.logout);
authRouter.post('/refresh',         authCtrl.refresh);
authRouter.post('/2fa/complete',    authCtrl.complete2FA);
authRouter.get('/me',               protect, authCtrl.getMe);
authRouter.put('/change-password',  protect, authCtrl.changePassword);
module.exports.authRouter = authRouter;
