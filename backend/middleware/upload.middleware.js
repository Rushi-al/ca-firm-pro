const multer    = require('multer');
const multerS3  = require('multer-s3');
const { S3Client, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ── S3 client ──────────────────────────────────────────────
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ── Allowed file types ─────────────────────────────────────
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'text/csv',
];

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Multer-S3 storage ──────────────────────────────────────
const storage = multerS3({
  s3,
  bucket: process.env.AWS_S3_BUCKET || 'ca-firm-pro-uploads',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req, file, cb) => {
    cb(null, {
      firmId:       req.firmId?.toString() || '',
      taskId:       req.params.taskId || '',
      uploadedBy:   req.user?._id?.toString() || '',
      originalName: file.originalname,
    });
  },
  key: (req, file, cb) => {
    // Organized path: firms/{firmId}/tasks/{taskId}/{uuid}-{filename}
    const ext      = path.extname(file.originalname).toLowerCase();
    const safeName = `${uuidv4()}${ext}`;
    const key      = `firms/${req.firmId}/tasks/${req.params.taskId}/${safeName}`;
    cb(null, key);
  },
});

// ── File filter ────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Accepted: PDF, Word, Excel, Images, CSV`), false);
  }
};

// ── Export upload middleware ───────────────────────────────
exports.upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } });

// ── Delete file from S3 ────────────────────────────────────
exports.deleteFromS3 = async (s3Key) => {
  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key:    s3Key,
    }));
  } catch (err) {
    console.error('S3 delete error:', err.message);
  }
};

// ── Generate pre-signed download URL (expires in 1 hour) ──
exports.getSignedDownloadUrl = async (s3Key) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key:    s3Key,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
};

// ── Local fallback (if no S3 configured) ──────────────────
// For development without S3, store locally
if (!process.env.AWS_ACCESS_KEY_ID) {
  console.warn('⚠️  AWS S3 not configured — using local disk storage for attachments.');
  const localStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = `./uploads/${req.firmId}/tasks/${req.params.taskId}`;
      require('fs').mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = require('path').extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  });
  exports.upload = multer({ storage: localStorage, fileFilter, limits: { fileSize: MAX_SIZE } });
}
