const crypto = require('crypto');
const base = () => (process.env.TELEMED_BASE_URL || 'https://meet.jit.si').replace(/\/+$/, '');
module.exports = {
  newRoom: () => `${process.env.TELEMED_ROOM_PREFIX || 'icthospital'}-${crypto.randomBytes(12).toString('hex')}`,
  url: (a) => `${base()}/${encodeURIComponent(String(a.video_room ?? ''))}`,
};
