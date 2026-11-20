// Official Google authorization-code flow. Userinfo is fetched server-to-server
// with the access token obtained from Google's token endpoint; no decoded JWT is trusted.
const { createHash } = require('node:crypto');
function googleClient({ clientId = process.env.GOOGLE_CLIENT_ID, clientSecret = process.env.GOOGLE_CLIENT_SECRET,
  baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000', fetchImpl = fetch } = {}) {
  const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/auth/google/callback`;
  return {
    configured: Boolean(clientId && clientSecret),
    authorization(state, verifier) {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri,
        response_type: 'code', scope: 'openid email profile', state,
        code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
      return url.toString();
    },
    async exchange(code, verifier) {
      const response = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(5000),
        body: new URLSearchParams({ code, code_verifier: verifier, client_id: clientId,
          client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString() });
      if (!response.ok) throw new Error('Provider rejected the code');
      const token = await response.json();
      if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('Provider token missing');
      const profile = await fetchImpl('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(5000) });
      if (!profile.ok) throw new Error('Provider profile unavailable');
      return profile.json();
    },
  };
}
module.exports = { googleClient };
