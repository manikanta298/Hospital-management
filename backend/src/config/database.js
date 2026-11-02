const fs = require('fs');

// All application and command-line connections use the same TLS settings.
function databaseConfig(env = process.env) {
  const config = { connectionString: env.DATABASE_URL };
  const caPath = env.DATABASE_CA_CERT_PATH;
  if (!caPath) return config; // Preserve local PostgreSQL and URL-based TLS settings.
  if (caPath !== caPath.trim() || !caPath.startsWith('/')) {
    throw new Error('DATABASE_CA_CERT_PATH must be an absolute path without surrounding spaces, e.g. /etc/secrets/ca.pem');
  }
  let ca;
  try { ca = fs.readFileSync(caPath, 'utf8'); }
  catch (error) { throw new Error(`Cannot read database CA certificate at ${caPath} (${error.code})`); }
  if (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
    throw new Error('Database CA file must contain a PEM certificate or certificate bundle');
  }
  if (!config.connectionString) throw new Error('DATABASE_URL is required when DATABASE_CA_CERT_PATH is set');
  const url = new URL(config.connectionString);
  // pg parses these after the config object and otherwise replaces ssl.ca.
  for (const key of ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) {
    url.searchParams.delete(key);
  }
  config.connectionString = url.toString();
  config.ssl = { ca, rejectUnauthorized: true };
  return config;
}
module.exports = databaseConfig;
