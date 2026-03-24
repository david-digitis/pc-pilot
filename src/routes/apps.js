const { launchApp, killApp, getRegisteredApps } = require('../system/process-manager');

async function appsRoutes(fastify) {
  fastify.post('/apps/launch', async (request, reply) => {
    const { id } = request.body || {};
    if (!id) return reply.code(400).send({ success: false, error: 'Missing app id' });

    try {
      const result = launchApp(id);
      return reply.code(202).send({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (err) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  fastify.post('/apps/kill', async (request, reply) => {
    const { id } = request.body || {};
    if (!id) return reply.code(400).send({ success: false, error: 'Missing app id' });

    try {
      const result = await killApp(id);
      return reply.code(200).send({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (err) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  fastify.get('/apps/registered', async () => {
    return { success: true, data: getRegisteredApps(), timestamp: new Date().toISOString() };
  });
}

module.exports = appsRoutes;
