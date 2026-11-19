const http = require('node:http');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { repository } = require('../data/repository');
const { authService } = require('../services/auth');
const { eventsService } = require('../services/events');
const { AppError } = require('../services/errors');

const statuses = { InvalidInput: 422, InvalidCredentials: 401, Unauthenticated: 401,
  ForbiddenOrigin: 403, TooLarge: 413, InvalidJson: 400, UnsupportedType: 415 };

function sessionToken(req) {
  return (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('club_session='))?.slice(13);
}

async function jsonBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
    throw new AppError('UnsupportedType', 'Send this request as JSON.');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) throw new AppError('TooLarge', 'This request is too large.');
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new AppError('InvalidJson', 'Send a valid JSON object.'); }
}

function createApp(db, { clock, secureCookies = false } = {}) {
  const data = repository(db);
  const auth = authService(data, clock);
  const events = eventsService(data, auth, clock);
  const web = path.resolve(__dirname, '../web');
  const assets = {
    '/styles.css': ['styles.css', 'text/css'], '/login.js': ['login.js', 'text/javascript'],
    '/events.js': ['events.js', 'text/javascript'], '/mark.svg': ['mark.svg', 'image/svg+xml'],
  };
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(value));
    };
    const redirect = destination => { res.writeHead(302, { Location: destination }); res.end(); };
    const file = (filename, type = 'text/html') => {
      const content = readFileSync(path.join(web, filename));
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }); res.end(content);
    };
    const cookie = token => `club_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${token ? 28800 : 0}${secureCookies ? '; Secure' : ''}`;
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = sessionToken(req);
      if (req.method === 'POST') {
        const origin = req.headers.origin;
        if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && new URL(origin).host !== req.headers.host)) {
          throw new AppError('ForbiddenOrigin', 'Open Club Calendar in this browser before submitting the form.');
        }
      }
      if (req.method === 'GET' && assets[url.pathname]) return file(...assets[url.pathname]);
      if (req.method === 'GET' && url.pathname === '/') return redirect('/events');
      if (req.method === 'GET' && url.pathname === '/login') return file('login.html');
      if (req.method === 'GET' && url.pathname === '/events') {
        try { auth.requireUser(token); } catch (error) {
          if (error.code === 'Unauthenticated') return redirect('/login');
          throw error;
        }
        return file('events.html');
      }
      if (req.method === 'GET' && url.pathname === '/api/events') return json(200, events.list(token));
      if (req.method === 'POST' && url.pathname === '/api/auth/login') {
        const body = await jsonBody(req);
        const result = await auth.login(body.email, body.password);
        res.setHeader('Set-Cookie', cookie(result.token));
        return json(200, { user: result.user });
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
        await jsonBody(req);
        auth.logout(token);
        res.setHeader('Set-Cookie', cookie(''));
        res.writeHead(204); return res.end();
      }
      return json(404, { error: 'NotFound', message: 'This page could not be found.' });
    } catch (error) {
      if (error instanceof AppError) return json(statuses[error.code] || 400, { error: error.code, message: error.message });
      // Do not log request bodies, cookies, database values or error messages containing them.
      console.error('Request failed:', error.name);
      return json(500, { error: 'InternalError', message: 'We could not complete that request. Please try again.' });
    }
  });
}
module.exports = { createApp };
