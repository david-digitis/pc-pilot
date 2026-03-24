const { app } = require('electron');
const { loadConfig, getConfig, getLocalIP } = require('./src/config');
const { createServer } = require('./src/server');
const { initTray } = require('./src/tray');

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
    console.log(`[PC-Pilot] Service ready at http://${localIP}:${config.server.port}`);
    console.log(`[PC-Pilot] API Token: ${config.security.token.substring(0, 8)}...`);
  } catch (err) {
    console.error('[PC-Pilot] Failed to start server:', err.message);
    app.quit();
    return;
  }

  // Initialize tray icon
  initTray(app);

  console.log('[PC-Pilot] Ready. Right-click tray icon for options.');
});

app.on('window-all-closed', (e) => {
  // No windows — we live in the tray
  e.preventDefault();
});
