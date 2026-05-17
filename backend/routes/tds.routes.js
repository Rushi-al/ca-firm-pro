const express = require('express');
const { protect, tenantGuard, authorize } = require('../middleware/auth.middleware');
const tds = require('../controllers/tds.controller');

const tdsRouter = express.Router();

tdsRouter.use(protect, tenantGuard);

tdsRouter.get('/return-types',          tds.getReturnTypes);
tdsRouter.get('/upcoming',              tds.getUpcoming);
tdsRouter.get('/calendar',              tds.getCalendar);
tdsRouter.post('/generate', authorize('Owner','Admin'), tds.generateSchedule);
tdsRouter.delete('/client/:clientId/return/:returnType', authorize('Owner','Admin'), tds.removeSchedule);
tdsRouter.put('/:id/file',              tds.markFiled);
tdsRouter.post('/:id/create-task', authorize('Owner','Admin'), tds.createTaskFromFiling);

module.exports = tdsRouter;
