const { AppError } = require('./errors');
function posterService(auth, client, { timeoutMs = 5000 } = {}) {
  const fallback = () => ({ source: 'manual', suggestion: null,
    message: 'Poster assistance is unavailable. Enter the event details manually.' });
  const text = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  return {
    async read(token, image) {
      const user = auth.requireUser(token);
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
      if (!client.configured) return fallback();
      let timer;
      let result;
      try {
        result = await Promise.race([client.read({ mimeType: image.mimeType, data: image.data }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Poster timeout')), timeoutMs); })]);
      } catch { return fallback(); }
      finally { clearTimeout(timer); }
      if (!result || typeof result !== 'object' || Array.isArray(result)) return fallback();
      const title = text(result.title, 120); const venue = text(result.venue, 160);
      let startsAt = '';
      if (typeof result.startsAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{3})?)?Z$/.test(result.startsAt)) {
        const date = new Date(result.startsAt);
        if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 16) === result.startsAt.slice(0, 16)) startsAt = date.toISOString();
      }
      if (!title && !venue && !startsAt) return fallback();
      return { source: 'suggestion', suggestion: { title, startsAt, venue },
        message: 'Suggested details only. Check and correct them before saving the event.' };
    },
  };
}
module.exports = { posterService };
