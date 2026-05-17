// ── gst.routes.js ─────────────────────────────────────────
const express = require('express');
const { protect, tenantGuard, authorize } = require('../middleware/auth.middleware');
const gst = require('../controllers/gst.controller');

const gstRouter = express.Router();
gstRouter.use(protect, tenantGuard);
gstRouter.get('/return-types',          gst.getReturnTypes);
gstRouter.get('/upcoming',              gst.getUpcoming);
gstRouter.get('/calendar',              gst.getCalendar);
gstRouter.post('/generate', authorize('Owner','Admin'), gst.generateSchedule);
gstRouter.put('/:id/file',              gst.markFiled);
gstRouter.post('/:id/create-task', authorize('Owner','Admin'), gst.createTaskFromFiling);
gstRouter.delete('/client/:clientId/return/:returnType', authorize('Owner','Admin'), gst.removeSchedule);
module.exports.gstRouter = gstRouter;

// ── recurring.routes.js ────────────────────────────────────
const recCtrl = require('../controllers/recurring.controller');
const recRouter = express.Router();
recRouter.use(protect, tenantGuard, authorize('Owner','Admin'));
recRouter.get('/',           recCtrl.getAll);
recRouter.post('/',          recCtrl.create);
recRouter.put('/:id/toggle', recCtrl.toggle);
recRouter.delete('/:id',     recCtrl.remove);
module.exports.recRouter = recRouter;

// ── attachment.routes.js ───────────────────────────────────
const { upload } = require('../middleware/upload.middleware');
const attCtrl    = require('../controllers/attachment.controller');
const attRouter  = express.Router({ mergeParams: true });
attRouter.use(protect, tenantGuard);
attRouter.get('/',                 attCtrl.list);
attRouter.post('/', upload.single('file'), attCtrl.upload);
attRouter.delete('/:attachmentId', attCtrl.remove);
module.exports.attRouter = attRouter;

// ── portal.routes.js ───────────────────────────────────────
const portalCtrl = require('../controllers/portal.controller');
const portalRouter = express.Router();

// Public portal routes
portalRouter.post('/login', portalCtrl.login);

// Admin: create portal access
portalRouter.post('/create-access', protect, tenantGuard, authorize('Owner','Admin'), portalCtrl.createAccess);

// Client-authenticated portal routes
portalRouter.get('/tasks',     portalCtrl.clientProtect, portalCtrl.getMyTasks);
portalRouter.get('/gst',       portalCtrl.clientProtect, portalCtrl.getMyGSTFilings);
portalRouter.get('/documents', portalCtrl.clientProtect, portalCtrl.getMyDocuments);

module.exports.portalRouter = portalRouter;
