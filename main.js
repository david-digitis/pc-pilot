// Must be before require('electron') — VS Code terminal sets this
delete process.env.ELECTRON_RUN_AS_NODE;

const { app } = require('electron');

// Linux: avoid needing suid chrome-sandbox
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}
const { loadConfig, getConfig, getLocalIP } = require('./src/config');
const { createServer } = require('./src/server');
const { initTray } = require('./src/tray');
const log = require('./src/logger');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.whenReady().then(async () => {
  // Load config (creates default if first run)
  loadConfig();
  const config = getConfig();

  // Start Fastify server
  try {
    await createServer();
    const localIP = getLocalIP();
    log.info({ url: `http://${localIP}:${config.server.port}` }, 'Service ready');
    log.info({ token: `${config.security.token.substring(0, 8)}...` }, 'API token');
  } catch (err) {
    log.error({ err: err.message }, 'Failed to start server');
    app.quit();
    return;
  }

  // Initialize tray icon
  initTray(app);

  log.info('Ready — right-click tray icon for options');
});

app.on('window-all-closed', (e) => {
  // No windows — we live in the tray
  e.preventDefault();
});
