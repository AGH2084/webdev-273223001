window.ClubAPI = async (path, { method = 'GET', body } = {}) => {
  const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(path === '/api/poster' ? 35000 : 10000) });
  if (response.status === 401) { location.assign('/login'); throw new Error('Sign in to continue.'); }
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'The request could not be completed. Please try again.');
  return result;
};
