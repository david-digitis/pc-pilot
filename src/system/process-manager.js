const { spawn, execFile } = require('child_process');
const os = require('os');
const { getConfig } = require('../config');
const log = require('../logger');

const isWindows = os.platform() === 'win32';

function launchApp(appId) {
  const config = getConfig();
  const app = config.apps?.find(a => a.id === appId);
  if (!app) throw new Error(`Unknown app: ${appId}`);

  const platform = isWindows ? 'win32' : 'linux';
  const appPath = typeof app.path === 'string' ? app.path : app.path?.[platform];
  if (!appPath) throw new Error(`No path configured for ${appId} on ${platform}`);

  const args = typeof app.args === 'object' && !Array.isArray(app.args)
    ? (app.args[platform] || [])
    : (app.args || []);

  log.info({ app: appId, path: appPath }, 'Launching app');

  const proc = spawn(appPath, args, {
    detached: true,
    stdio: 'ignore',
    shell: false,
  });
  proc.unref();

  return { pid: proc.pid, label: app.label || appId };
}

function killApp(appId) {
  const config = getConfig();
  const app = config.apps?.find(a => a.id === appId);
  const processName = app?.processName || appId;

  return new Promise((resolve, reject) => {
    if (isWindows) {
      execFile('taskkill', ['/IM', `${processName}.exe`, '/F'], { shell: false }, (err) => {
        if (err) return reject(new Error(`Failed to kill ${processName}`));
        resolve({ message: `${processName} terminated` });
      });
    } else {
      execFile('pkill', ['-f', processName], { shell: false }, (err) => {
        if (err) return reject(new Error(`Failed to kill ${processName}`));
        resolve({ message: `${processName} terminated` });
      });
    }
  });
}

function getRegisteredApps() {
  const config = getConfig();
  return (config.apps || []).map(a => ({
    id: a.id,
    label: a.label || a.id,
  }));
}

module.exports = { launchApp, killApp, getRegisteredApps };
