// upload.js
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const cors    = require('cors');

const app = express();

// تفعيل CORS أثناء التطوير
app.use(cors());

// تأكد أن مجلد uploads/videos موجود
const videosDir = path.join(__dirname, 'uploads', 'videos');
fs.mkdirSync(videosDir, { recursive: true });

// تقديم الملفات تحت /videos/اسم-الملف.mp4
app.use('/videos', express.static(videosDir));

// إعداد التخزين للفيديوهات
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, videosDir);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/\s+/g, '_');
    const unique   = Date.now() + '-' + safeName;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 } // حتى 1GB
});

// API لرفع فيديو واحد
app.post('/upload-video', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const videoUrl = `/videos/${req.file.filename}`; // هذا ما يُستخدم في admin و research-view
  res.json({ url: videoUrl });
});

// تشغيل السيرفر
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Upload server running on http://localhost:${PORT}`);
});
