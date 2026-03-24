const { execFile } = require('child_process');
const os = require('os');
const { getConfig } = require('../config');

const isWindows = os.platform() === 'win32';

async function commandsRoutes(fastify) {
  fastify.post('/commands/execute', async (request, reply) => {
    const { id } = request.body || {};
    if (!id) return reply.code(400).send({ success: false, error: 'Missing command id' });

    const config = getConfig();
    const cmd = config.commands?.find(c => c.id === id);
    if (!cmd) {
      console.warn(`[Commands] UNKNOWN id=${id} ip=${request.ip}`);
      return reply.code(400).send({ success: false, error: `Unknown command: ${id}` });
    }

    const platform = isWindows ? 'win32' : 'linux';
    const exe = typeof cmd.command === 'string' ? cmd.command : cmd.command?.[platform];
    const args = typeof cmd.args === 'object' && !Array.isArray(cmd.args)
      ? (cmd.args[platform] || [])
      : (cmd.args || []);
    const timeout = cmd.timeout || 30000;

    if (!exe) {
      return reply.code(400).send({ success: false, error: `No command configured for ${id} on ${platform}` });
    }

    return new Promise((resolve) => {
      console.log(`[Commands] Executing: ${id} (${exe})`);

      // SECURITY: execFile with shell: false
      execFile(exe, args, { timeout, shell: false }, (err, stdout, stderr) => {
        if (err) {
          console.error(`[Commands] ${id} failed:`, err.message);
          resolve(reply.code(500).send({
            success: false,
            error: `Command failed: ${err.message}`,
            timestamp: new Date().toISOString(),
          }));
          return;
        }

        console.log(`[Commands] ${id} OK`);
        resolve({
          success: true,
          data: { id, label: cmd.label || id, output: stdout.trim() },
          timestamp: new Date().toISOString(),
        });
      });
    });
  });

  fastify.get('/commands/list', async () => {
    const config = getConfig();
    const commands = (config.commands || []).map(c => ({
      id: c.id,
      label: c.label || c.id,
      description: c.description || '',
    }));
    return { success: true, data: commands, timestamp: new Date().toISOString() };
  });
}

module.exports = commandsRoutes;
