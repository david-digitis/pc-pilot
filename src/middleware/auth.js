const crypto = require('crypto');
const { getConfig } = require('../config');

async function authMiddleware(request, reply) {
  const authHeader = request.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    console.warn(`[Auth] MISSING ip=${request.ip} path=${request.url}`);
    return reply.code(401).send({ success: false, error: 'Unauthorized' });
  }

  const config = getConfig();
  const expected = Buffer.from(config.security.token);
  const provided = Buffer.from(token);

  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    console.warn(`[Auth] FAILED ip=${request.ip} path=${request.url}`);
    return reply.code(401).send({ success: false, error: 'Unauthorized' });
  }
}

module.exports = { authMiddleware };
