const { executeSystemCommand } = require('../system/commands');
const { getSystemStatus } = require('../system/status');

async function systemRoutes(fastify) {
  for (const action of ['shutdown', 'reboot', 'sleep', 'hibernate', 'lock']) {
    fastify.post(`/system/${action}`, async (request, reply) => {
      try {
        const result = await executeSystemCommand(action);
        return reply.code(202).send({ success: true, ...result, timestamp: new Date().toISOString() });
      } catch (err) {
        return reply.code(500).send({ success: false, error: err.message, timestamp: new Date().toISOString() });
      }
    });
  }

  fastify.get('/system/status', async () => {
    const status = getSystemStatus();
    return { success: true, data: status, timestamp: new Date().toISOString() };
  });
}

module.exports = systemRoutes;
