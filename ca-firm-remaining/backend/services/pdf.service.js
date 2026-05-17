// PDF generation using pdfkit (npm install pdfkit)
// Generates: Task Reports, Client Summary PDFs

const PDFDocument = require('pdfkit');

const AMBER  = '#f59e0b';
const DARK   = '#0f172a';
const SLATE  = '#64748b';
const WHITE  = '#f1f5f9';
const GREEN  = '#34d399';
const RED    = '#f87171';

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const fmtAmt  = a => a != null ? `Rs. ${Number(a).toLocaleString('en-IN')}` : '—';

// ── Shared header ─────────────────────────────────────────
function drawHeader(doc, firmName, title) {
  // Dark background bar
  doc.rect(0, 0, doc.page.width, 80).fill(DARK);

  // CA logo box
  doc.roundedRect(30, 20, 40, 40, 6).fill(AMBER);
  doc.fontSize(16).fillColor(DARK).font('Helvetica-Bold').text('CA', 30, 32, { width: 40, align: 'center' });

  // Firm name + title
  doc.fontSize(14).fillColor(WHITE).font('Helvetica-Bold').text(firmName, 82, 22);
  doc.fontSize(10).fillColor(SLATE).font('Helvetica').text(title, 82, 40);
  doc.fontSize(9).fillColor(SLATE).text(`Generated: ${fmtDate(new Date())}`, 82, 56);

  doc.moveDown(4);
}

// ── Section header ────────────────────────────────────────
function sectionHeader(doc, text) {
  doc.rect(30, doc.y, doc.page.width - 60, 24).fill('#1e293b');
  doc.fontSize(9).fillColor(AMBER).font('Helvetica-Bold')
    .text(text.toUpperCase(), 38, doc.y - 18, { width: doc.page.width - 76 });
  doc.moveDown(1.2);
}

// ── Stat box ──────────────────────────────────────────────
function statBox(doc, x, y, label, value, color = WHITE) {
  doc.rect(x, y, 110, 52).fill('#1e293b').stroke('#334155');
  doc.fontSize(20).fillColor(color).font('Helvetica-Bold').text(value, x, y + 8, { width: 110, align: 'center' });
  doc.fontSize(8).fillColor(SLATE).font('Helvetica').text(label.toUpperCase(), x, y + 34, { width: 110, align: 'center' });
}

// ─────────────────────────────────────────────────────────
// Generate Task Report PDF
// Returns a readable stream
// ─────────────────────────────────────────────────────────
exports.generateTaskReport = (data) => {
  const { firmName, tasks, filters = {} } = data;
  const doc = new PDFDocument({ margin: 30, size: 'A4' });

  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#020817');
  drawHeader(doc, firmName, 'Task Report');

  // Stats
  const total     = tasks.length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const overdue   = tasks.filter(t => t.status !== 'Completed' && new Date(t.deadline) < new Date()).length;
  const inProg    = tasks.filter(t => t.status === 'In Progress').length;

  const sy = doc.y;
  statBox(doc, 30,  sy, 'Total',       total,     WHITE);
  statBox(doc, 150, sy, 'Completed',   completed, GREEN);
  statBox(doc, 270, sy, 'In Progress', inProg,    AMBER);
  statBox(doc, 390, sy, 'Overdue',     overdue,   overdue > 0 ? RED : GREEN);
  doc.moveDown(5);

  // Table header
  sectionHeader(doc, 'All Tasks');

  const cols = { title: 30, client: 210, assigned: 320, status: 400, deadline: 470 };
  const rowH = 22;

  // Column headers
  doc.rect(30, doc.y, doc.page.width - 60, 18).fill('#334155');
  doc.fontSize(8).fillColor(SLATE).font('Helvetica-Bold');
  doc.text('TASK',     cols.title,    doc.y - 13);
  doc.text('CLIENT',   cols.client,   doc.y - 13 + doc.currentLineHeight());
  // reset
  const hY = doc.y - doc.currentLineHeight();
  doc.text('TASK',     cols.title,    hY + 5);
  doc.text('CLIENT',   cols.client,   hY + 5);
  doc.text('ASSIGNED', cols.assigned, hY + 5);
  doc.text('STATUS',   cols.status,   hY + 5);
  doc.text('DEADLINE', cols.deadline, hY + 5);
  doc.moveDown(0.8);

  // Rows
  tasks.forEach((t, i) => {
    const y       = doc.y;
    const isOD    = t.status !== 'Completed' && new Date(t.deadline) < new Date();
    const rowColor= i % 2 === 0 ? '#0f172a' : '#1e293b';

    if (y > doc.page.height - 80) {
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#020817');
    }

    doc.rect(30, doc.y, doc.page.width - 60, rowH).fill(rowColor);
    doc.fontSize(8).fillColor(WHITE).font('Helvetica');

    const cy = doc.y + 7;
    doc.text(t.title?.slice(0, 28) || '—',          cols.title,    cy, { width: 175 });
    doc.text(t.clientId?.name?.slice(0, 20) || '—', cols.client,   cy, { width: 105 });
    doc.text(t.assignedTo?.name?.split(' ')[0] || '—', cols.assigned, cy, { width: 75 });

    const statusColor = isOD ? RED : t.status === 'Completed' ? GREEN : AMBER;
    doc.fillColor(statusColor).text(isOD ? 'Overdue' : t.status, cols.status, cy, { width: 65 });
    doc.fillColor(isOD ? RED : SLATE).text(fmtDate(t.deadline), cols.deadline, cy, { width: 80 });

    doc.moveDown(1.2);
  });

  doc.end();
  return doc;
};

// ─────────────────────────────────────────────────────────
// Generate Client Summary PDF
// ─────────────────────────────────────────────────────────
exports.generateClientSummary = (data) => {
  const { firmName, client, tasks, gstFilings = [], itrRecords = [], timeEntries = [] } = data;
  const doc = new PDFDocument({ margin: 30, size: 'A4' });

  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#020817');
  drawHeader(doc, firmName, `Client Summary — ${client.name}`);

  // Client info box
  doc.rect(30, doc.y, doc.page.width - 60, 70).fill('#0f172a').stroke('#1e293b');
  const iy = doc.y + 12;
  doc.fontSize(14).fillColor(WHITE).font('Helvetica-Bold').text(client.name, 45, iy);
  doc.fontSize(9).fillColor(SLATE).font('Helvetica');
  if (client.gstNumber) doc.text(`GSTIN: ${client.gstNumber}`, 45, iy + 22);
  if (client.contact)   doc.text(`Contact: ${client.contact}`, 45, iy + 36);
  if (client.email)     doc.text(`Email: ${client.email}`,     45, iy + 50);
  doc.moveDown(5);

  // Task stats
  const total     = tasks.length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const overdue   = tasks.filter(t => t.status !== 'Completed' && new Date(t.deadline) < new Date()).length;
  const totalHrs  = timeEntries.reduce((s, e) => s + (e.durationMins || 0), 0);
  const billed    = timeEntries.reduce((s, e) => s + (e.billedAmount || 0), 0);

  const sy = doc.y;
  statBox(doc, 30,  sy, 'Total Tasks', total,     WHITE);
  statBox(doc, 150, sy, 'Completed',   completed, GREEN);
  statBox(doc, 270, sy, 'Overdue',     overdue,   overdue > 0 ? RED : GREEN);
  statBox(doc, 390, sy, 'Hours Logged', `${(totalHrs/60).toFixed(1)}h`, AMBER);
  doc.moveDown(5);

  // Billing summary
  if (billed > 0) {
    doc.rect(30, doc.y, doc.page.width - 60, 32).fill('#1e293b');
    doc.fontSize(11).fillColor(AMBER).font('Helvetica-Bold')
      .text(`Total Billed: ${fmtAmt(billed)}`, 38, doc.y - 24, { width: doc.page.width - 76 });
    doc.moveDown(2);
  }

  // Recent tasks
  sectionHeader(doc, 'Tasks');
  tasks.slice(0, 15).forEach((t, i) => {
    const isOD  = t.status !== 'Completed' && new Date(t.deadline) < new Date();
    const rowBg = i % 2 === 0 ? '#0f172a' : '#1e293b';
    doc.rect(30, doc.y, doc.page.width - 60, 20).fill(rowBg);
    const cy = doc.y + 5;
    doc.fontSize(8).fillColor(WHITE).font('Helvetica').text(t.title?.slice(0,40) || '—', 38, cy, { width: 280 });
    const sc = isOD ? RED : t.status === 'Completed' ? GREEN : AMBER;
    doc.fillColor(sc).text(isOD ? 'Overdue' : t.status, 330, cy, { width: 80 });
    doc.fillColor(SLATE).text(fmtDate(t.deadline), 420, cy, { width: 100 });
    doc.moveDown(1.1);
  });

  // GST filings
  if (gstFilings.length > 0) {
    doc.moveDown(1);
    sectionHeader(doc, 'GST Filings');
    gstFilings.slice(0, 10).forEach((f, i) => {
      const rowBg = i % 2 === 0 ? '#0f172a' : '#1e293b';
      doc.rect(30, doc.y, doc.page.width - 60, 20).fill(rowBg);
      const cy = doc.y + 5;
      doc.fontSize(8).fillColor(AMBER).font('Helvetica-Bold').text(f.returnType, 38, cy, { width: 70 });
      doc.fillColor(WHITE).font('Helvetica').text(`M${f.period?.month || ''} ${f.period?.year || ''}`, 115, cy, { width: 80 });
      const sc = f.status === 'filed' ? GREEN : f.status === 'overdue' ? RED : AMBER;
      doc.fillColor(sc).text(f.status, 210, cy, { width: 70 });
      doc.fillColor(SLATE).text(fmtDate(f.dueDate), 295, cy, { width: 100 });
      doc.fillColor(f.filedDate ? GREEN : SLATE).text(fmtDate(f.filedDate), 405, cy, { width: 100 });
      doc.moveDown(1.1);
    });
  }

  // Footer
  const fy = doc.page.height - 40;
  doc.rect(0, fy - 10, doc.page.width, 50).fill(DARK);
  doc.fontSize(8).fillColor(SLATE).font('Helvetica')
    .text(`CA Firm Pro — Confidential — ${firmName}`, 30, fy, { width: doc.page.width - 60, align: 'center' });

  doc.end();
  return doc;
};
