const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const { root } = require('./upload');
// Saves a data:image/jpeg|png;base64 webcam capture (verified by magic bytes). Returns the storage path or null.
function saveDataUrl(dataUrl, sub) {
  const m = String(dataUrl || '').match(/^data:image\/(jpeg|png);base64,(.+)$/);
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  const ok = m[1] === 'png' ? buf.slice(0, 4).toString('hex') === '89504e47' : buf.slice(0, 2).toString('hex') === 'ffd8';
  if (!ok) return null;
  const rel = `${sub}/${crypto.randomBytes(16).toString('hex')}.${m[1] === 'png' ? 'png' : 'jpg'}`;
  fs.mkdirSync(path.join(root, sub), { recursive: true });
  fs.writeFileSync(path.join(root, rel), buf);
  return rel;
}
module.exports = { saveDataUrl };
