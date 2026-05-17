const cron        = require('node-cron');
const nodemailer  = require('nodemailer');
const Task        = require('../models/Task');
const User        = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

// ── Email transporter ──────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendMail = async (to, subject, html) => {
  if (!process.env.EMAIL_USER) return; // Skip if email not configured
  try {
    await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
    console.log(`📧 Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, err.message);
  }
};

// ── Daily reminder cron — runs at 8:00 AM every day ───────
cron.schedule('0 8 * * *', async () => {
  console.log('⏰ Running daily deadline reminders...');
  try {
    const now      = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    const tomorrowStart = new Date(tomorrow);
    tomorrowStart.setHours(0, 0, 0, 0);

    // Tasks due tomorrow, not completed
    const dueTomorrow = await Task.find({
      status:   { $ne: 'Completed' },
      deadline: { $gte: tomorrowStart, $lte: tomorrow },
    })
      .populate('assignedTo', 'name email firmId')
      .populate('clientId',   'name');

    // Send individual reminders
    for (const task of dueTomorrow) {
      const emp = task.assignedTo;
      if (!emp?.email) continue;

      await sendMail(
        emp.email,
        `⚠️ Reminder: "${task.title}" is due tomorrow`,
        `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#f59e0b">Task Due Tomorrow</h2>
          <p>Hi ${emp.name},</p>
          <p>This is a reminder that the following task is due <strong>tomorrow</strong>:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;color:#666">Task</td><td style="padding:8px;font-weight:bold">${task.title}</td></tr>
            <tr style="background:#f9f9f9"><td style="padding:8px;color:#666">Client</td><td style="padding:8px">${task.clientId?.name}</td></tr>
            <tr><td style="padding:8px;color:#666">Deadline</td><td style="padding:8px;color:#ef4444">${new Date(task.deadline).toLocaleDateString('en-IN')}</td></tr>
            <tr style="background:#f9f9f9"><td style="padding:8px;color:#666">Progress</td><td style="padding:8px">${task.progress}%</td></tr>
          </table>
          <a href="${process.env.FRONTEND_URL}/tasks" style="background:#f59e0b;color:#000;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">View Task →</a>
        </div>
        `
      );

      await ActivityLog.create({
        firmId: emp.firmId,
        userId: emp._id,
        action: `Reminder email sent for task: "${task.title}"`,
        taskId: task._id,
      });
    }

    // Admin summary — tasks overdue or due in 3 days
    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);

    const upcomingTasks = await Task.find({
      status:   { $ne: 'Completed' },
      deadline: { $lte: in3Days },
    })
      .populate('assignedTo', 'name firmId')
      .populate('clientId',   'name');

    // Group by firmId
    const byFirm = {};
    for (const task of upcomingTasks) {
      const fid = task.assignedTo?.firmId?.toString();
      if (!fid) continue;
      if (!byFirm[fid]) byFirm[fid] = [];
      byFirm[fid].push(task);
    }

    // Send one summary per firm to all Owners/Admins
    for (const [firmId, tasks] of Object.entries(byFirm)) {
      const admins = await User.find({ firmId, role: { $in: ['Owner', 'Admin'] } });
      const taskRows = tasks.map(t =>
        `<tr><td style="padding:6px">${t.title}</td><td style="padding:6px">${t.clientId?.name}</td><td style="padding:6px;color:${new Date(t.deadline) < now ? '#ef4444' : '#f59e0b'}">${new Date(t.deadline).toLocaleDateString('en-IN')}</td><td style="padding:6px">${t.assignedTo?.name}</td></tr>`
      ).join('');

      for (const admin of admins) {
        await sendMail(
          admin.email,
          `📋 Daily Summary: ${tasks.length} task(s) need attention`,
          `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#f59e0b">Daily Task Summary</h2>
            <p>Hi ${admin.name}, here are tasks needing attention:</p>
            <table style="width:100%;border-collapse:collapse;border:1px solid #eee">
              <thead><tr style="background:#f1f5f9"><th style="padding:8px;text-align:left">Task</th><th style="padding:8px;text-align:left">Client</th><th style="padding:8px;text-align:left">Deadline</th><th style="padding:8px;text-align:left">Assigned To</th></tr></thead>
              <tbody>${taskRows}</tbody>
            </table>
            <a href="${process.env.FRONTEND_URL}/tasks" style="background:#f59e0b;color:#000;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:16px">View All Tasks →</a>
          </div>
          `
        );
      }
    }

    console.log(`✅ Reminders sent: ${dueTomorrow.length} individual, ${Object.keys(byFirm).length} firm summaries`);
  } catch (err) {
    console.error('❌ Reminder cron error:', err.message);
  }
});

console.log('✅ Reminder cron job scheduled (daily 8:00 AM)');
