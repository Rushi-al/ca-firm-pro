// WhatsApp notifications via Twilio WhatsApp Business API
// Docs: https://www.twilio.com/docs/whatsapp

let twilioClient = null;

const getClient = () => {
  if (!twilioClient) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.warn('⚠️  Twilio not configured — WhatsApp notifications disabled.');
      return null;
    }
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
};

const FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

// Format phone number for WhatsApp (must include country code)
const formatPhone = (phone) => {
  const clean = phone.replace(/\D/g, '');
  // Add India country code if 10 digits
  return `whatsapp:+${clean.length === 10 ? '91' + clean : clean}`;
};

// ── Send a single WhatsApp message ────────────────────────
const send = async (to, body) => {
  const client = getClient();
  if (!client) return;
  try {
    const msg = await client.messages.create({ from: FROM, to: formatPhone(to), body });
    console.log(`📱 WhatsApp sent to ${to}: ${msg.sid}`);
    return msg;
  } catch (err) {
    console.error(`❌ WhatsApp failed to ${to}:`, err.message);
  }
};

// ── Task assigned notification ────────────────────────────
exports.notifyTaskAssigned = async ({ employeePhone, employeeName, taskTitle, clientName, deadline }) => {
  if (!employeePhone) return;
  await send(
    employeePhone,
    `*CA Firm Pro* 📋\n\nHi ${employeeName}, a new task has been assigned to you:\n\n*Task:* ${taskTitle}\n*Client:* ${clientName}\n*Deadline:* ${new Date(deadline).toLocaleDateString('en-IN')}\n\nLog in to view details.`
  );
};

// ── Task deadline reminder ────────────────────────────────
exports.notifyDeadlineReminder = async ({ employeePhone, employeeName, taskTitle, clientName, deadline, daysLeft }) => {
  if (!employeePhone) return;
  const urgency = daysLeft === 0 ? '🚨 DUE TODAY' : daysLeft === 1 ? '⚠️ Due Tomorrow' : `📅 Due in ${daysLeft} days`;
  await send(
    employeePhone,
    `*CA Firm Pro* ${urgency}\n\n*Task:* ${taskTitle}\n*Client:* ${clientName}\n*Deadline:* ${new Date(deadline).toLocaleDateString('en-IN')}\n\nPlease complete this task on time.`
  );
};

// ── GST deadline alert ────────────────────────────────────
exports.notifyGSTDeadline = async ({ employeePhone, employeeName, returnType, clientName, dueDate, daysLeft }) => {
  if (!employeePhone) return;
  await send(
    employeePhone,
    `*CA Firm Pro* 🧾 GST Alert\n\nHi ${employeeName},\n\n*${returnType}* for *${clientName}* is due in *${daysLeft} days*.\n\n*Due Date:* ${new Date(dueDate).toLocaleDateString('en-IN')}\n\nPlease file on time to avoid penalties.`
  );
};

// ── Task completed notification (to Admin) ────────────────
exports.notifyTaskCompleted = async ({ adminPhone, adminName, employeeName, taskTitle, clientName }) => {
  if (!adminPhone) return;
  await send(
    adminPhone,
    `*CA Firm Pro* ✅ Task Completed\n\n*${employeeName}* has completed:\n\n*Task:* ${taskTitle}\n*Client:* ${clientName}\n\nLogged at ${new Date().toLocaleString('en-IN')}`
  );
};

// ── Invoice generated notification ───────────────────────
exports.notifyInvoice = async ({ ownerPhone, firmName, invoiceNumber, amount }) => {
  if (!ownerPhone) return;
  await send(
    ownerPhone,
    `*CA Firm Pro* 🧾 Payment Received\n\nThank you for your payment!\n\n*Firm:* ${firmName}\n*Invoice:* ${invoiceNumber}\n*Amount:* ₹${(amount/100).toLocaleString('en-IN')}\n\nYour subscription is now active.`
  );
};
