// ── client.routes.js ──────────────────────────────────────
const express = require('express');
const { protect, tenantGuard, authorize, checkPlanLimit } = require('../middleware/auth.middleware');

const clientRouter = express.Router();
clientRouter.use(protect, tenantGuard);
const cc = require('../controllers/client.controller');
clientRouter.route('/')
  .get(cc.getClients)
  .post(authorize('Owner','Admin'), checkPlanLimit('clients'), cc.createClient);
clientRouter.route('/:id')
  .get(cc.getClient)
  .put(authorize('Owner','Admin'),    cc.updateClient)
  .delete(authorize('Owner','Admin'), cc.deleteClient);
module.exports.clientRouter = clientRouter;

// ── task.routes.js ─────────────────────────────────────────
const taskRouter = express.Router();
taskRouter.use(protect, tenantGuard);
const tc = require('../controllers/task.controller');
taskRouter.get('/stats', authorize('Owner','Admin'), tc.getStats);
taskRouter.route('/')
  .get(tc.getTasks)
  .post(authorize('Owner','Admin'), tc.createTask);
taskRouter.route('/:id')
  .get(tc.getTask)
  .put(tc.updateTask)
  .delete(authorize('Owner','Admin'), tc.deleteTask);
module.exports.taskRouter = taskRouter;

// ── user.routes.js ─────────────────────────────────────────
const userRouter = express.Router();
userRouter.use(protect, tenantGuard, authorize('Owner','Admin'));
const uc = require('../controllers/user.controller');
userRouter.route('/')
  .get(uc.getUsers)
  .post(checkPlanLimit('employees'), uc.createUser);
userRouter.route('/:id')
  .put(uc.updateUser)
  .delete(uc.deleteUser);
module.exports.userRouter = userRouter;

// ── activity.routes.js ─────────────────────────────────────
const activityRouter = express.Router();
activityRouter.use(protect, tenantGuard, authorize('Owner','Admin'));
const ac = require('../controllers/activity.controller');
activityRouter.get('/', ac.getLogs);
module.exports.activityRouter = activityRouter;
