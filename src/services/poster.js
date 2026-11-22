const { AppError } = require('./errors');
function posterService(auth, client, { timeoutMs = 30000 } = {}) {
  const messages = {
    PosterNotConfigured: 'Poster assistance is not configured on the server. Restart it with GEMINI_API_KEY loaded.',
    PosterRequestRejected: 'Google rejected the poster request. Check the API key and selected model configuration.',
    PosterAccessDenied: 'Google refused API access. Check the Gemini API key and its project permissions.',
    PosterModelUnavailable: 'The configured poster model is unavailable. Check MODEL_NAME and model access.',
    PosterRateLimited: 'Google reports a rate limit or exhausted quota. Check the API project quota and try again later.',
    PosterProviderUnavailable: 'The poster provider is temporarily unavailable. Try again later.',
    PosterTimeout: 'Poster assistance timed out after 30 seconds. Try again.',
    PosterInvalidResponse: 'The provider did not return usable poster details. Try a clearer image.',
  };
  const fallback = code => ({ source: 'manual', suggestion: null,
    message: `${messages[code] || 'Poster assistance is unavailable.'} Enter the event details manually.` });
  const text = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  return {
    async read(token, image) {
      const user = await auth.requireUser(token);
      if (user.role !== 'organiser') throw new AppError('Forbidden', 'Only an organiser may read a poster.');
      if (!image || image.consent !== true || !['image/png', 'image/jpeg'].includes(image.mimeType) ||
          typeof image.data !== 'string' || image.data.length > 1400000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)) {
        throw new AppError('InvalidInput', 'Choose a PNG or JPEG poster up to 1 MB and confirm sending it for assistance.');
      }
      const bytes = Buffer.from(image.data, 'base64');
      const header = bytes.subarray(0, image.mimeType === 'image/png' ? 8 : 3).toString('hex');
      if (bytes.length > 1048576 || bytes.toString('base64') !== image.data ||
          header !== (image.mimeType === 'image/png' ? '89504e470d0a1a0a' : 'ffd8ff')) {
        throw new AppError('InvalidInput', 'This file is not a supported PNG or JPEG poster.');
      }
      if (!client.configured) return fallback('PosterNotConfigured');
      let timer;
      let result;
      try {
        result = await Promise.race([client.read({ mimeType: image.mimeType, data: image.data }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('Poster timeout'), { code: 'PosterTimeout' })), timeoutMs); })]);
      } catch (error) { return fallback(error.code); }
      finally { clearTimeout(timer); }
      if (!result || typeof result !== 'object' || Array.isArray(result)) return fallback('PosterInvalidResponse');
      const title = text(result.title, 120); const venue = text(result.venue, 160);
      const description = text(result.description, 2000);
      const capacity = Number.isSafeInteger(result.capacity) && result.capacity >= 1 && result.capacity <= 5000 ? result.capacity : null;
      let startsAt = '';
      if (typeof result.startsAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{3})?)?Z$/.test(result.startsAt)) {
        const date = new Date(result.startsAt);
        if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 16) === result.startsAt.slice(0, 16)) startsAt = date.toISOString();
      }
      if (!title && !venue && !startsAt && !description && capacity === null) return fallback('PosterInvalidResponse');
      return { source: 'suggestion', suggestion: { title, startsAt, venue, capacity, description },
        message: 'Suggested details only. Check and correct them before saving the event.' };
    },
  };
}
module.exports = { posterService };
