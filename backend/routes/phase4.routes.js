const express = require('express');
const { protect, tenantGuard, authorize } = require('../middleware/auth.middleware');

// ── Time routes ────────────────────────────────────────────
const timeCtrl  = require('../controllers/time.controller');
const timeRouter = express.Router();
timeRouter.use(protect, tenantGuard);
timeRouter.get('/report',           authorize('Owner','Admin'), timeCtrl.getReport);
timeRouter.get('/',                 timeCtrl.getAll);
timeRouter.post('/',                timeCtrl.create);
timeRouter.put('/:id',              timeCtrl.update);
timeRouter.delete('/:id',           timeCtrl.remove);
timeRouter.put('/:id/approve',      authorize('Owner','Admin'), timeCtrl.approve);
module.exports.timeRouter = timeRouter;

// ── ITR routes ─────────────────────────────────────────────
const itrCtrl  = require('../controllers/itr.controller');
const itrRouter = express.Router();
itrRouter.use(protect, tenantGuard);
itrRouter.get('/forms',             itrCtrl.getForms);
itrRouter.get('/upcoming',          itrCtrl.getUpcoming);
itrRouter.get('/',                  itrCtrl.getAll);
itrRouter.post('/',                 authorize('Owner','Admin'), itrCtrl.create);
itrRouter.put('/:id',               itrCtrl.update);
itrRouter.post('/:id/create-task',  authorize('Owner','Admin'), itrCtrl.createTask);
itrRouter.delete('/:id',            authorize('Owner','Admin'), itrCtrl.remove);
module.exports.itrRouter = itrRouter;

// ── Reports routes ─────────────────────────────────────────
const repCtrl  = require('../controllers/reports.controller');
const repRouter = express.Router();
repRouter.use(protect, tenantGuard, authorize('Owner','Admin'));
repRouter.get('/overview',          repCtrl.overview);
repRouter.get('/productivity',      repCtrl.productivity);
repRouter.get('/clients',           repCtrl.clientReport);
repRouter.get('/export',            repCtrl.exportCSV);
module.exports.repRouter = repRouter;
