const multer = require('multer'); const path = require('path'); const fs = require('fs'); const crypto = require('crypto');
const root = path.resolve(__dirname, '../../uploads');
const storage = (sub) => multer.diskStorage({
  destination: (req, f, cb) => { const d = path.join(root, sub); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
  filename: (req, f, cb) => cb(null, `${crypto.randomBytes(8).toString('hex')}${path.extname(f.originalname).toLowerCase()}`),
});
const make = (sub, extensions, maxMb = 5) => multer({ storage: storage(sub), limits: { fileSize: maxMb * 1024 * 1024 }, fileFilter: (req, f, cb) => cb(null, !extensions || extensions.includes(path.extname(f.originalname).toLowerCase().slice(1))) });
module.exports = { make, root };
