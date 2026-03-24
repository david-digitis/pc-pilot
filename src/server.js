const Fastify = require('fastify');
const { getConfig } = require('./config');
const { authMiddleware } = require('./middleware/auth');
const { ipFilterMiddleware } = require('./middleware/ip-filter');
const log = require('./logger');

async function createServer() {
  const config = getConfig();

  const fastify = Fastify({
    logger: false, // We log ourselves
  });

  // Rate limiting
  await fastify.register(require('@fastify/rate-limit'), {
    max: 30,
    timeWindow: '1 minute',
  });

  // Auth hook — skip for routes marked noAuth
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip auth for health check
    if (request.routeOptions?.config?.noAuth) return;

    await ipFilterMiddleware(request, reply);
    if (reply.sent) return;

    await authMiddleware(request, reply);
  });

  // Register routes under /api/v1 prefix
  fastify.register(require('./routes/meta'), { prefix: '/api/v1' });
  fastify.register(require('./routes/system'), { prefix: '/api/v1' });
  fastify.register(require('./routes/apps'), { prefix: '/api/v1' });
  fastify.register(require('./routes/commands'), { prefix: '/api/v1' });

  // Start
  const host = config.server.host || '0.0.0.0';
  const port = config.server.port || 7042;

  await fastify.listen({ port, host });
  log.info({ host, port }, 'Server listening');

  return fastify;
}

module.exports = { createServer };
