require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db'); const createApp = require('./app');
(async () => {
  await db.init();
  const port = process.env.PORT || 8000;
  createApp().listen(port, () => console.log(`ICTHospital API listening on http://localhost:${port}`));
})().catch((e) => { console.error(e); process.exit(1); });
