const cron        = require('node-cron');
const nodemailer  = require('nodemailer');
const Firm        = require('../models/Firm');
const User        = require('../models/User');
const Task        = require('../models/Task');
const GSTFiling   = require('../models/GSTFiling');
const IncomeTax   = require('../models/IncomeTax');
const Notification= require('../models/Notification');
const notifSvc    = require('./notification.service');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const send = async (to, subject, html) => {
  if (!process.env.EMAIL_USER) return;
  try {
    await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
  } catch (err) {
    console.error(`Email failed ${to}:`, err.message);
  }
};

// ── Monday 7AM weekly summary ──────────────────────────────
cron.schedule('0 7 * * 1', async () => {
  console.log('📧 Sending weekly summaries…');
  try {
    const firms = await Firm.find({ isActive: true });
    for (const firm of firms) {
      const now   = new Date();
      const in7   = new Date(now.getTime() + 7 * 864e5);
      const week  = new Date(now.getTime() - 7 * 864e5);

      const [
        totalTasks, completedThisWeek, overdueTasks,
        upcomingTasks, gstDue, itrDue, admins,
      ] = await Promise.all([
        Task.countDocuments({ firmId: firm._id, status: { $ne: 'Completed' } }),
        Task.countDocuments({ firmId: firm._id, status: 'Completed', updatedAt: { $gte: week } }),
        Task.countDocuments({ firmId: firm._id, status: { $ne: 'Completed' }, deadline: { $lt: now } }),
        Task.find({ firmId: firm._id, status: { $ne: 'Completed' }, deadline: { $gte: now, $lte: in7 } })
          .populate('clientId','name').populate('assignedTo','name').sort({ deadline: 1 }).limit(10),
        GSTFiling.countDocuments({ firmId: firm._id, status: { $ne: 'filed' }, dueDate: { $gte: now, $lte: in7 } }),
        IncomeTax.countDocuments({ firmId: firm._id, status: { $nin: ['filed','revised'] }, dueDate: { $gte: now, $lte: in7 } }),
        User.find({ firmId: firm._id, role: { $in: ['Owner','Admin'] } }),
      ]);

      const taskRows = upcomingTasks.map(t =>
        `<tr><td style="padding:6px 12px">${t.title}</td><td style="padding:6px 12px">${t.clientId?.name}</td><td style="padding:6px 12px">${t.assignedTo?.name?.split(' ')[0]}</td><td style="padding:6px 12px;color:${new Date(t.deadline)<now?'#f87171':'#f59e0b'}">${new Date(t.deadline).toLocaleDateString('en-IN')}</td></tr>`
      ).join('');

      const html = `
        <div style="font-family:sans-serif;max-width:640px;margin:0 auto;background:#020817;color:#f1f5f9;padding:32px;border-radius:16px">
          <div style="text-align:center;margin-bottom:28px">
            <div style="background:rgba(245,158,11,.1);border-radius:12px;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#f59e0b;font-size:16px">CA</div>
            <h2 style="color:#f1f5f9;margin-top:12px">Weekly Summary — ${firm.name}</h2>
            <p style="color:#64748b;font-size:13px">Week of ${now.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</p>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
            ${[
              { label:'Active Tasks',      val: totalTasks,       color:'#f1f5f9' },
              { label:'Completed (7 days)',val: completedThisWeek,color:'#34d399' },
              { label:'Overdue',           val: overdueTasks,     color: overdueTasks>0?'#f87171':'#34d399' },
            ].map(s=>`<div style="background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:16px;text-align:center"><p style="font-size:28px;font-weight:700;color:${s.color};margin:0">${s.val}</p><p style="font-size:11px;color:#64748b;margin:6px 0 0;text-transform:uppercase;letter-spacing:.04em">${s.label}</p></div>`).join('')}
          </div>

          ${gstDue > 0 || itrDue > 0 ? `
          <div style="background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.3);border-radius:10px;padding:14px;margin-bottom:20px">
            <p style="color:#f87171;font-size:13px;margin:0">⚠️ Compliance this week: ${gstDue} GST filing${gstDue!==1?'s':''} + ${itrDue} ITR deadline${itrDue!==1?'s':''}</p>
          </div>` : ''}

          ${upcomingTasks.length > 0 ? `
          <p style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Tasks Due This Week</p>
          <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px">
            <thead><tr style="background:#0f172a">
              <th style="text-align:left;padding:8px 12px;color:#475569">Task</th>
              <th style="text-align:left;padding:8px 12px;color:#475569">Client</th>
              <th style="text-align:left;padding:8px 12px;color:#475569">Assigned</th>
              <th style="text-align:left;padding:8px 12px;color:#475569">Deadline</th>
            </tr></thead>
            <tbody>${taskRows}</tbody>
          </table>` : '<p style="color:#475569;font-size:13px;margin-bottom:20px">✅ No tasks due this week.</p>'}

          <div style="text-align:center">
            <a href="${process.env.FRONTEND_URL}/dashboard" style="background:#f59e0b;color:#020817;padding:11px 28px;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px;display:inline-block">Open Dashboard →</a>
          </div>
        </div>
      `;

      for (const admin of admins) {
        await send(admin.email, `📊 Weekly Summary — ${firm.name}`, html);
        await notifSvc.create({
          firmId: firm._id, userId: admin._id,
          type:    'weekly_summary',
          title:   'Weekly Summary Ready',
          message: `${completedThisWeek} tasks completed, ${overdueTasks} overdue, ${gstDue + itrDue} compliance deadlines this week.`,
          link:    '/dashboard',
        });
      }
    }
    console.log(`✅ Weekly summaries sent to ${firms.length} firms`);
  } catch (err) {
    console.error('Weekly summary cron error:', err.message);
  }
});

// ── Daily deadline notifications (3 days + 1 day warnings) ─
cron.schedule('0 8 * * *', async () => {
  console.log('🔔 Sending deadline notifications…');
  try {
    const now  = new Date();
    const in1  = new Date(now.getTime() + 1  * 864e5);
    const in3  = new Date(now.getTime() + 3  * 864e5);
    const in7  = new Date(now.getTime() + 7  * 864e5);

    // Task deadlines
    const tasks = await Task.find({
      status:   { $ne: 'Completed' },
      deadline: { $gte: now, $lte: in7 },
    }).populate('assignedTo','_id firmId name').populate('clientId','name');

    for (const task of tasks) {
      if (!task.assignedTo) continue;
      const daysLeft = Math.ceil((new Date(task.deadline) - now) / 864e5);
      if (![1,3,7].includes(daysLeft)) continue;
      await notifSvc.create({
        firmId:  task.assignedTo.firmId,
        userId:  task.assignedTo._id,
        type:    'task_overdue',
        title:   `Task due in ${daysLeft} day${daysLeft!==1?'s':''}`,
        message: `"${task.title}" for ${task.clientId?.name} is due ${daysLeft===1?'tomorrow':`in ${daysLeft} days`}`,
        taskId:  task._id,
        link:    '/tasks',
      });
    }

    // GST deadlines
    const gstFilings = await GSTFiling.find({
      status:  { $ne: 'filed' },
      dueDate: { $gte: now, $lte: in7 },
    }).populate('clientId','name');

    const firms = await Firm.find({ isActive: true });
    for (const f of gstFilings) {
      const daysLeft = Math.ceil((new Date(f.dueDate) - now) / 864e5);
      if (![1,3,7].includes(daysLeft)) continue;
      const admins = await User.find({ firmId: f.firmId, role: { $in: ['Owner','Admin'] } });
      await notifSvc.gstDeadline({
        firmId:    f.firmId,
        userIds:   admins.map(a => a._id),
        returnType:f.returnType,
        clientName:f.clientId?.name,
        daysLeft,
      });
    }

    console.log('✅ Deadline notifications sent');
  } catch (err) {
    console.error('Deadline notification cron error:', err.message);
  }
});

console.log('✅ Notification crons scheduled (Mon 7AM weekly, daily 8AM deadlines)');
