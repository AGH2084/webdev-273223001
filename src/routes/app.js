const http = require('node:http');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { repository } = require('../data/repository');
const { authService } = require('../services/auth');
const { eventsService } = require('../services/events');
const { AppError } = require('../services/errors');
const { registrationsService } = require('../services/registrations');
const { eventManagement } = require('../services/event-management');
const browserHeaders = require('../http/headers');
const { googleClient } = require('../auth/google-client');
const { providerAuth } = require('../services/provider-auth');

const statuses = { InvalidInput: 422, InvalidCredentials: 401, Unauthenticated: 401,
  ForbiddenOrigin: 403, Forbidden: 403, NotFound: 404, EventFull: 409, EventPast: 409,
  AlreadyRegistered: 409, CapacityConflict: 409, ProviderUnavailable: 503, InvalidOAuthState: 400,
  UnverifiedIdentity: 403, TooLarge: 413, InvalidJson: 400, UnsupportedType: 415 };

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

function createApp(db, { clock, secureCookies = false, providerClient = googleClient() } = {}) {
  const data = repository(db);
  const auth = authService(data, clock);
  const events = eventsService(data, auth, clock);
  const registrations = registrationsService(data, auth, clock);
  const management = eventManagement(data, auth, clock);
  const provider = providerAuth(data, auth, providerClient, clock);
  const web = path.resolve(__dirname, '../web');
  const assets = {
    '/styles.css': ['styles.css', 'text/css'], '/login.js': ['login.js', 'text/javascript'],
    '/events.js': ['events.js', 'text/javascript'], '/mark.svg': ['mark.svg', 'image/svg+xml'],
  };
  return http.createServer(async (req, res) => {
    for (const [key, value] of Object.entries(browserHeaders)) res.setHeader(key, value);
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
      if (req.method === 'GET' && url.pathname === '/api/auth/providers') return json(200, { google: provider.available() });
      if (req.method === 'GET' && url.pathname === '/api/auth/google') {
        const flow = provider.begin();
        res.setHeader('Set-Cookie', `club_oauth=${flow.state}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=600${secureCookies ? '; Secure' : ''}`);
        return redirect(flow.url);
      }
      if (req.method === 'GET' && url.pathname === '/api/auth/google/callback') {
        const browserState = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('club_oauth='))?.slice(11);
        res.setHeader('Set-Cookie', `club_oauth=; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=0${secureCookies ? '; Secure' : ''}`);
        try {
          const result = await provider.complete(url.searchParams.get('state'), browserState, url.searchParams.get('code'));
          res.setHeader('Set-Cookie', [cookie(result.token), ...[].concat(res.getHeader('Set-Cookie'))]);
          return redirect('/events');
        } catch (error) {
          if (error instanceof AppError) return redirect('/login?provider=failed');
          throw error;
        }
      }
      if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
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
      if (url.pathname.startsWith('/api/') && ['POST', 'PATCH', 'DELETE'].includes(req.method) && !url.pathname.startsWith('/api/auth/')) auth.requireUser(token);
      if (req.method === 'GET' && url.pathname === '/api/registrations') return json(200, { registrations: registrations.mine(token) });
      if (req.method === 'POST' && url.pathname === '/api/registrations') return json(201, registrations.register(token, (await jsonBody(req)).eventId));
      const registrationPath = url.pathname.match(/^\/api\/registrations\/(\d+)$/);
      if (req.method === 'DELETE' && registrationPath) {
        registrations.cancel(token, Number(registrationPath[1])); res.writeHead(204); return res.end();
      }
      if (req.method === 'GET' && url.pathname === '/api/clubs') return json(200, { clubs: management.clubs(token) });
      if (req.method === 'POST' && url.pathname === '/api/events') return json(201, management.create(token, await jsonBody(req)));
      const eventPath = url.pathname.match(/^\/api\/events\/(\d+)$/);
      if (req.method === 'GET' && eventPath) return json(200, management.detail(token, Number(eventPath[1])));
      if (req.method === 'PATCH' && eventPath) return json(200, management.edit(token, Number(eventPath[1]), await jsonBody(req)));
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
