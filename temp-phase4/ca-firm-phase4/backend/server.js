// ── ADD THESE LINES to your server.js after Phase 3 routes ──
//
// const { timeRouter, itrRouter, repRouter } = require('./routes/phase4.routes');
// app.use('/api/time',    timeRouter);
// app.use('/api/itr',     itrRouter);
// app.use('/api/reports', repRouter);
//
// Also install new packages:
// npm install  (no new packages needed — uses existing mongoose aggregation)

// ─────────────────────────────────────────────────────────
// FULL UPDATED server.js (replace existing)
// ─────────────────────────────────────────────────────────
require('dotenv').config();
const express       = require('express');
const mongoose      = require('mongoose');
const cors          = require('cors');
const helmet        = require('helmet');
const morgan        = require('morgan');
const rateLimit     = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss           = require('xss-clean');
const path          = require('path');

const app = express();

// Webhook raw body
const billingRoutes = require('./routes/billing.routes');
app.use('/api/billing/webhook',
  express.raw({ type:'application/json' }),
  (req,res,next) => { req.body = JSON.parse(req.body); next(); },
  billingRoutes
);

app.use(helmet());
app.use(mongoSanitize());
app.use(xss());

const limiter     = rateLimit({ windowMs:15*60*1000, max:100, message:{success:false,message:'Too many requests.',data:null} });
const authLimiter = rateLimit({ windowMs:15*60*1000, max:20,  message:{success:false,message:'Too many login attempts.',data:null} });
app.use('/api', limiter);
app.use('/api/auth/login',     authLimiter);
app.use('/api/firms/register', authLimiter);
app.use('/api/portal/login',   authLimiter);

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials:true }));
app.use(express.json({ limit:'10kb' }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ─────────────────────────────────────────────────
const firmRoutes   = require('./routes/firm.routes');
const authRoutes   = require('./routes/auth.routes');
const { clientRouter, taskRouter, userRouter, activityRouter } = require('./routes/index');
const { gstRouter, recRouter, attRouter, portalRouter }        = require('./routes/phase3.routes');
const { timeRouter, itrRouter, repRouter }                     = require('./routes/phase4.routes');

app.use('/api/firms',      firmRoutes);
app.use('/api/auth',       authRoutes);
app.use('/api/billing',    billingRoutes);
app.use('/api/clients',    clientRouter);
app.use('/api/tasks',      taskRouter);
app.use('/api/users',      userRouter);
app.use('/api/activities', activityRouter);
app.use('/api/gst',        gstRouter);
app.use('/api/recurring',  recRouter);
app.use('/api/tasks/:taskId/attachments', attRouter);
app.use('/api/portal',     portalRouter);
app.use('/api/time',       timeRouter);
app.use('/api/itr',        itrRouter);
app.use('/api/reports',    repRouter);

app.get('/api/health', (req,res) =>
  res.json({ success:true, message:'CA Firm Pro SaaS v2.3 running' })
);
app.use((req,res) =>
  res.status(404).json({ success:false, message:`${req.originalUrl} not found.`, data:null })
);
app.use((err,req,res,next) => {
  console.error('💥', err.message);
  res.status(err.statusCode||500).json({
    success:false,
    message: process.env.NODE_ENV==='production' ? 'Something went wrong.' : err.message,
    data:null,
  });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(process.env.PORT||5000, () =>
      console.log(`🚀 Server on http://localhost:${process.env.PORT||5000}`)
    );
    require('./services/reminder.service');
    require('./services/subscription.cron');
    require('./controllers/recurring.controller');
  })
  .catch(err => { console.error('❌', err.message); process.exit(1); });
