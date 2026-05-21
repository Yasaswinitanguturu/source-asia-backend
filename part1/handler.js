const { allow, getAllStats } = require('./rateLimiter');

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function handleRequest(req, res) {
  if (req.method !== 'POST') {
    return sendJSON(res, 405, { error: 'Method not allowed. Use POST.' });
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });

  req.on('end', () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      return sendJSON(res, 400, { error: 'Invalid JSON body' });
    }

    if (!parsed.user_id || typeof parsed.user_id !== 'string' || parsed.user_id.trim() === '') {
      return sendJSON(res, 400, { error: 'user_id is required and must be a non-empty string' });
    }

    if (parsed.payload === undefined) {
      return sendJSON(res, 400, { error: 'payload is required' });
    }

    const result = allow(parsed.user_id.trim());

    if (!result.allowed) {
      return sendJSON(res, 429, {
        error: 'Rate limit exceeded. Maximum 5 requests per minute.',
        accepted_in_window: result.acceptedInWindow,
        rejected_total: result.rejectedTotal,
      });
    }

    return sendJSON(res, 201, {
      message: 'Request accepted',
      user_id: parsed.user_id.trim(),
      payload: parsed.payload,
      accepted_in_window: result.acceptedInWindow,
    });
  });
}

function handleStats(req, res) {
  if (req.method !== 'GET') {
    return sendJSON(res, 405, { error: 'Method not allowed. Use GET.' });
  }

  const stats = getAllStats();
  return sendJSON(res, 200, { users: stats });
}

module.exports = { handleRequest, handleStats };