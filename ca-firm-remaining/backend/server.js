require('dotenv').config();
const express       = require('express');
const mongoose      = require('mongoose');
const cors          = require('cors');
const helmet        = require('helmet');
const morgan        = require('morgan');
const rateLimit     = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss           = require('xss-clean');
const cookieParser  = require('cookie-parser');
const path          = require('path');

const app = express();

// ── Webhook raw body (must be before json parser) ──────────
const billingRoutes = require('./routes/billing.routes');
app.use('/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => { req.body = JSON.parse(req.body); next(); },
  billingRoutes
);

// ── Security middleware ────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "https://checkout.razorpay.com"],
      frameSrc:   ["'self'", "https://api.razorpay.com"],
    },
  },
}));
app.use(mongoSanitize());
app.use(xss());
app.use(cookieParser());

// Rate limiters
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  message: { success: false, message: 'Too many requests. Try again later.', data: null },
  standardHeaders: true, legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.', data: null },
});
app.use('/api', limiter);
app.use('/api/auth/login',        authLimiter);
app.use('/api/firms/register',    authLimiter);
app.use('/api/portal/login',      authLimiter);
app.use('/api/auth/2fa/complete', authLimiter);

// ── CORS — locked to frontend domain only ─────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,      // Required for cookies
  methods:     ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json({ limit: '10kb' }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Serve local uploads (dev fallback)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ─────────────────────────────────────────────────
const firmRoutes   = require('./routes/firm.routes');
const { clientRouter, taskRouter, userRouter, activityRouter } = require('./routes/index');
const { gstRouter, recRouter, attRouter, portalRouter }        = require('./routes/phase3.routes');
const { timeRouter, itrRouter, repRouter }                     = require('./routes/phase4.routes');
const {
  notifRouter, tfRouter, pdfRouter,
  signAdminRouter, signPortalRouter, authRouter,
} = require('./routes/remaining.routes');

app.use('/api/auth',            authRouter);
app.use('/api/auth/2fa',        tfRouter);
app.use('/api/firms',           firmRoutes);
app.use('/api/billing',         billingRoutes);
app.use('/api/clients',         clientRouter);
app.use('/api/tasks',           taskRouter);
app.use('/api/tasks',           signAdminRouter);   // POST /api/tasks/:taskId/request-signoff
app.use('/api/users',           userRouter);
app.use('/api/activities',      activityRouter);
app.use('/api/notifications',   notifRouter);
app.use('/api/gst',             gstRouter);
app.use('/api/recurring',       recRouter);
app.use('/api/tasks/:taskId/attachments', attRouter);
app.use('/api/portal',          portalRouter);
app.use('/api/portal/tasks',    signPortalRouter);  // GET pending-signoff, PUT signoff
app.use('/api/time',            timeRouter);
app.use('/api/itr',             itrRouter);
app.use('/api/reports',         repRouter);
app.use('/api/pdf',             pdfRouter);

app.get('/api/health', (req, res) =>
  res.json({ success: true, message: 'CA Firm Pro SaaS v3.0 — All systems operational' })
);

app.use((req, res) =>
  res.status(404).json({ success: false, message: `${req.originalUrl} not found.`, data: null })
);
app.use((err, req, res, next) => {
  // Never log passwords
  console.error('💥', err.message);
  res.status(err.statusCode || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message,
    data: null,
  });
});

// ── Connect DB & Start ─────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 CA Firm Pro v3.0 running on http://localhost:${PORT}`));

    // Start all cron jobs
    require('./services/reminder.service');       // Daily 8AM task deadline emails
    require('./services/subscription.cron');      // Daily midnight plan expiry
    require('./controllers/recurring.controller');// Daily 6AM recurring task generation
    require('./services/weekly.cron');            // Monday 7AM weekly summary + daily deadline notifications
  })
  .catch(err => { console.error('❌ DB Error:', err.message); process.exit(1); });
