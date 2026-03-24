const crypto = require('crypto');
const { getConfig } = require('../config');
const log = require('../logger');

async function authMiddleware(request, reply) {
  const authHeader = request.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    log.warn({ ip: request.ip, path: request.url }, 'Auth missing token');
    return reply.code(401).send({ success: false, error: 'Unauthorized' });
  }

  const config = getConfig();
  const expected = Buffer.from(config.security.token);
  const provided = Buffer.from(token);

  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    log.warn({ ip: request.ip, path: request.url }, 'Auth failed');
    return reply.code(401).send({ success: false, error: 'Unauthorized' });
  }
}

module.exports = { authMiddleware };
