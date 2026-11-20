const { randomBytes } = require('node:crypto');
const { AppError } = require('./errors');
const { digest, hashPassword } = require('./auth');

function providerAuth(data, auth, client, clock = () => new Date()) {
  return {
    available() { return client.configured; },
    begin() {
      if (!client.configured) throw new AppError('ProviderUnavailable', 'Google sign-in is unavailable. Use your email and password.');
      const state = randomBytes(32).toString('hex');
      const verifier = randomBytes(32).toString('base64url');
      data.storeOAuthState(digest(state), verifier, new Date(clock().getTime() + 600000).toISOString());
      return { state, url: client.authorization(state, verifier) };
    },
    async complete(state, browserState, code) {
      if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state) || state !== browserState ||
          typeof code !== 'string' || !code || code.length > 2048) {
        throw new AppError('InvalidOAuthState', 'Sign-in could not be verified. Start again.');
      }
      const flow = data.consumeOAuthState(digest(state), clock().toISOString());
      if (!flow) throw new AppError('InvalidOAuthState', 'This sign-in has expired or was already used. Start again.');
      let profile;
      try { profile = await client.exchange(code, flow.verifier); }
      catch { throw new AppError('ProviderUnavailable', 'Google sign-in failed. Use your email and password or try again.'); }
      if (!profile || typeof profile.sub !== 'string' || !profile.sub || profile.sub.length > 255 ||
          profile.email_verified !== true || typeof profile.email !== 'string' ||
          profile.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
        throw new AppError('UnverifiedIdentity', 'Google must verify your email before this account can sign in.');
      }
      const email = profile.email.toLowerCase();
      const name = typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim().slice(0, 100) : email;
      const randomHash = await hashPassword(randomBytes(32).toString('hex'));
      return data.transaction(() => {
        const linked = data.providerUser(profile.sub);
        if (linked) return auth.issueSession(linked);
        const user = data.findUser(email) || data.createProviderUser(email, name, randomHash);
        data.linkProvider(profile.sub, user.id);
        return auth.issueSession(user);
      });
    },
  };
}
module.exports = { providerAuth };
