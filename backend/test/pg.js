// Starts a throwaway PostgreSQL (embedded-postgres) for tests, or uses TEST_DATABASE_URL if set.
const path = require('path'); const fs = require('fs'); const os = require('os');
module.exports = async function startPg() {
  if (process.env.TEST_DATABASE_URL) return { url: process.env.TEST_DATABASE_URL, stop: async () => {} };
  const EmbeddedPostgres = require('embedded-postgres').default;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icth-pg-')); const port = 54000 + Math.floor(Math.random() * 900);
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port, persistent: false, createPostgresUser: process.getuid && process.getuid() === 0, onLog: () => {}, onError: () => {} });
  await pg.initialise(); await pg.start(); await pg.createDatabase('icth');
  return { url: `postgres://postgres:postgres@localhost:${port}/icth`, stop: async () => { await pg.stop(); fs.rmSync(dir, { recursive: true, force: true }); } };
};
