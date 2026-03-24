const os = require('os');
const { getConfig, getLocalIP } = require('../config');
const { getSystemCommands } = require('../system/commands');

async function metaRoutes(fastify) {
  // Health check — NO AUTH required
  fastify.get('/health', { config: { noAuth: true } }, async () => {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      version: require('../../package.json').version,
      hostname: os.hostname(),
      platform: os.platform(),
      timestamp: new Date().toISOString(),
    };
  });

  // Endpoints listing — generates curl commands for Gladys config
  fastify.get('/endpoints', async (request) => {
    const config = getConfig();
    const baseUrl = `http://${getLocalIP()}:${config.server.port}`;
    const token = 'YOUR_TOKEN';

    const endpoints = [];

    // System commands
    const systemCmds = getSystemCommands();
    for (const cmd of systemCmds) {
      endpoints.push({
        method: 'POST',
        path: `/api/v1/system/${cmd.id}`,
        label: cmd.label,
        curl: `curl -X POST ${baseUrl}/api/v1/system/${cmd.id} -H "Authorization: Bearer ${token}"`,
      });
    }

    // Status
    endpoints.push({
      method: 'GET',
      path: '/api/v1/system/status',
      label: 'Statut systeme',
      curl: `curl ${baseUrl}/api/v1/system/status -H "Authorization: Bearer ${token}"`,
    });

    // Registered apps
    const apps = config.apps || [];
    for (const app of apps) {
      endpoints.push({
        method: 'POST',
        path: '/api/v1/apps/launch',
        label: `Lancer ${app.label || app.id}`,
        body: { id: app.id },
        curl: `curl -X POST ${baseUrl}/api/v1/apps/launch -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d "{\\"id\\":\\"${app.id}\\"}"`,
      });
    }

    // Custom commands
    const commands = config.commands || [];
    for (const cmd of commands) {
      endpoints.push({
        method: 'POST',
        path: '/api/v1/commands/execute',
        label: cmd.label || cmd.id,
        body: { id: cmd.id },
        curl: `curl -X POST ${baseUrl}/api/v1/commands/execute -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d "{\\"id\\":\\"${cmd.id}\\"}"`,
      });
    }

    return {
      success: true,
      data: { baseUrl, endpoints },
      timestamp: new Date().toISOString(),
    };
  });
}

module.exports = metaRoutes;
