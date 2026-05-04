import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'data', 'uploads');

function ensureUploadDir() {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureUploadDir();
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').slice(0, 8) || '.bin';
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = /^image\/(jpeg|png|gif|webp|svg\+xml)$/i.test(file.mimetype || '');
    if (!ok) {
      cb(new Error('仅支持 jpeg/png/gif/webp/svg 图片'));
      return;
    }
    cb(null, true);
  },
});

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

router.post('/image', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'BAD_REQUEST', message: '请使用 multipart 字段名 file 上传图片' });
    return;
  }
  const base =
    process.env.PUBLIC_BASE_URL && String(process.env.PUBLIC_BASE_URL).trim()
      ? String(process.env.PUBLIC_BASE_URL).replace(/\/$/, '')
      : '';
  const urlPath = `/uploads/${req.file.filename}`;
  const host = req.get('host') || '127.0.0.1:3000';
  const proto = req.protocol || 'http';
  const absolute = `${proto}://${host}${urlPath}`;
  const url = base ? `${base}${urlPath}` : absolute;
  res.status(201).json({ url, filename: req.file.filename });
});

router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: 'BAD_REQUEST', message: err.message });
    return;
  }
  if (err) {
    res.status(400).json({ error: 'BAD_REQUEST', message: err.message || '上传失败' });
    return;
  }
});

export default router;
