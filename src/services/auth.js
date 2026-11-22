const { randomBytes, scrypt, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const { AppError } = require('./errors');
const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const digest = token => createHash('sha256').update(token).digest('hex');

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, options);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [kind, salt, expected] = stored.split('$');
  if (kind !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(expected)) return false;
  const key = await derive(password, salt, 64, options);
  return timingSafeEqual(key, Buffer.from(expected, 'hex'));
}

function authService(data, clock = () => new Date()) {
  // Missing accounts still pay the password-derivation cost.
  const dummyHash = hashPassword(randomBytes(32).toString('hex'));
  const issueSession = async user => {
    const token = randomBytes(32).toString('hex');
    const expires = new Date(clock().getTime() + 8 * 60 * 60 * 1000).toISOString();
    await data.createSession(digest(token), user.id, expires);
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  };
  return {
    issueSession,
    async login(email, password) {
      if (typeof email !== 'string' || typeof password !== 'string' ||
          !email.trim() || email.length > 254 || !password || Buffer.byteLength(password) > 1024) {
        throw new AppError('InvalidInput', 'Enter your email and password.');
      }
      const user = await data.findUser(email.trim().toLowerCase());
      const matches = await verifyPassword(password, user ? user.password_hash : await dummyHash);
      if (!user || !matches) throw new AppError('InvalidCredentials', 'Email or password is incorrect');
      return issueSession(user);
    },
    async requireUser(token) {
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new AppError('Unauthenticated', 'Sign in to see club events.');
      const user = await data.sessionUser(digest(token), clock().toISOString());
      if (!user) throw new AppError('Unauthenticated', 'Your session has ended. Sign in again.');
      return user;
    },
    async logout(token) {
      await this.requireUser(token);
      await data.revokeSession(digest(token));
    },
  };
}
module.exports = { authService, hashPassword, verifyPassword, digest };
