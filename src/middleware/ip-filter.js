const { getConfig } = require('../config');

async function ipFilterMiddleware(request, reply) {
  const config = getConfig();
  const allowedIPs = config.security.allowedIPs || [];

  // If no IPs configured, allow all (token auth is still required)
  if (allowedIPs.length === 0) return;

  const clientIP = request.ip.replace('::ffff:', '');

  if (!allowedIPs.includes(clientIP)) {
    console.warn(`[IPFilter] REJECTED ip=${clientIP} path=${request.url}`);
    return reply.code(403).send({ success: false, error: 'Forbidden' });
  }
}

module.exports = { ipFilterMiddleware };
