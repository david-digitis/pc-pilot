const os = require('os');

function getSystemStatus() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptime: Math.floor(os.uptime()),
    memory: {
      total_mb: Math.round(totalMem / 1024 / 1024),
      free_mb: Math.round(freeMem / 1024 / 1024),
      used_percent: Math.round((1 - freeMem / totalMem) * 100),
    },
    cpu: {
      model: cpus[0]?.model || 'unknown',
      cores: cpus.length,
    },
  };
}

module.exports = { getSystemStatus };
