require('dotenv').config();
const express       = require('express');
const mongoose      = require('mongoose');
const cors          = require('cors');
const helmet        = require('helmet');
const morgan        = require('morgan');
const rateLimit     = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss           = require('xss-clean');

const app = express();

// ── Webhook must be registered BEFORE express.json() ──────
// Razorpay needs the raw body for signature verification
const billingRoutes = require('./routes/billing.routes');
app.use('/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    req.body = JSON.parse(req.body);
    next();
  },
  billingRoutes
);

// ── Security ───────────────────────────────────────────────
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());

const limiter = rateLimit({ windowMs: 15*60*1000, max: 100,
  message: { success: false, message: 'Too many requests.', data: null } });
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 20,
  message: { success: false, message: 'Too many login attempts.', data: null } });

app.use('/api', limiter);
app.use('/api/auth/login',       authLimiter);
app.use('/api/firms/register',   authLimiter);

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10kb' }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ── Routes ─────────────────────────────────────────────────
const firmRoutes     = require('./routes/firm.routes');
const authRoutes     = require('./routes/auth.routes');
const { clientRouter, taskRouter, userRouter, activityRouter } = require('./routes/index');

app.use('/api/firms',      firmRoutes);
app.use('/api/auth',       authRoutes);
app.use('/api/billing',    billingRoutes);
app.use('/api/clients',    clientRouter);
app.use('/api/tasks',      taskRouter);
app.use('/api/users',      userRouter);
app.use('/api/activities', activityRouter);

app.get('/api/health', (req, res) =>
  res.json({ success: true, message: 'CA Firm Pro SaaS v2.1 running', data: { env: process.env.NODE_ENV } })
);

// ── 404 + error handler ────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, message: `${req.originalUrl} not found.`, data: null })
);
app.use((err, req, res, next) => {
  console.error('💥', err.message);
  res.status(err.statusCode || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message,
    data: null,
  });
});

// ── Start ──────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));

    // Start cron jobs
    require('./services/reminder.service');
    require('./services/subscription.cron');
  })
  .catch(err => { console.error('❌ DB Error:', err.message); process.exit(1); });
