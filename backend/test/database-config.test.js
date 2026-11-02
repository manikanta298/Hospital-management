const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const databaseConfig = require('../src/config/database');

test('local and URL-based configurations are preserved without a CA path', () => {
  const url = 'postgres://localhost/hospital?sslmode=verify-full';
  assert.deepEqual(databaseConfig({ DATABASE_URL: url }), { connectionString: url });
});

test('explicit CA enables verification and prevents URL options replacing it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hospital-ca-'));
  try {
    const ca = require('tls').rootCertificates[0];
    const file = path.join(dir, 'ca.pem');
    fs.writeFileSync(file, ca);
    const config = databaseConfig({
      DATABASE_URL: 'postgres://user:password@localhost/hospital?sslmode=require&sslrootcert=wrong.pem&sslcert=wrong&sslkey=wrong&ssl=true&uselibpqcompat=true&application_name=hospital',
      DATABASE_CA_CERT_PATH: file,
    });
    assert.deepEqual(config.ssl, { ca, rejectUnauthorized: true });
    const url = new URL(config.connectionString);
    assert.equal(url.searchParams.toString(), 'application_name=hospital');
    assert.equal(url.username, 'user');
    assert.equal(url.password, 'password');
    assert.equal(url.pathname, '/hospital');
    fs.writeFileSync(file, 'invalid certificate');
    assert.throws(() => databaseConfig({ DATABASE_CA_CERT_PATH: file }), /PEM/);
    fs.unlinkSync(file);
    assert.throws(() => databaseConfig({ DATABASE_CA_CERT_PATH: file }), /Cannot read database CA/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('mistyped certificate paths fail clearly', () => {
  for (const file of [' /etc/secrets/ca.pem', '/etc/secrets/ca.pem ', 'ca.pem']) {
    assert.throws(() => databaseConfig({ DATABASE_CA_CERT_PATH: file }), /absolute path without surrounding spaces/);
  }
});
