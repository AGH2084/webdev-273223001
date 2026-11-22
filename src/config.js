function configuration(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('missing DATABASE_URL: see .env.example');
  let database;
  try { database = new URL(env.DATABASE_URL); } catch { throw new Error('DATABASE_URL must be a PostgreSQL URL'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) throw new Error('DATABASE_URL must be a PostgreSQL URL');
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  const baseUrl = env.PUBLIC_BASE_URL || 'http://localhost:3000';
  let publicUrl;
  try { publicUrl = new URL(baseUrl); } catch { throw new Error('PUBLIC_BASE_URL must be an HTTP(S) origin'); }
  if (!['http:', 'https:'].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password ||
      publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash) throw new Error('PUBLIC_BASE_URL must be an HTTP(S) origin');
  if (env.NODE_ENV === 'production' && (!env.PUBLIC_BASE_URL || publicUrl.protocol !== 'https:')) {
    throw new Error('production requires an HTTPS PUBLIC_BASE_URL: see .env.example');
  }
  return { databaseUrl: env.DATABASE_URL, port, baseUrl: publicUrl.origin, secureCookies: publicUrl.protocol === 'https:' };
}
module.exports = { configuration };
