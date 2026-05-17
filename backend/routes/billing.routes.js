const express = require('express');
const router  = express.Router();
const billing = require('../controllers/billing.controller');
const { protect, tenantGuard, authorize } = require('../middleware/auth.middleware');

// Public — plan listing
router.get('/plans', billing.getPlans);

// Webhook — raw body, no auth (Razorpay signs it)
router.post('/webhook', express.raw({ type: 'application/json' }), billing.webhook);

// Protected billing routes — Owner only
router.use(protect, tenantGuard, authorize('Owner'));

router.get('/overview',           billing.getOverview);
router.post('/create-order',      billing.createOrder);
router.post('/verify-payment',    billing.verifyPayment);
router.post('/cancel',            billing.cancelSubscription);
router.get('/invoices/:id',       billing.getInvoice);

module.exports = router;
