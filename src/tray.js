const { Tray, Menu, clipboard, nativeImage } = require('electron');
const { getConfig, regenerateToken, reloadConfig, watchConfig, getConfigPath, getLocalIP } = require('./config');
const { isEnabled: isAutostartEnabled, toggle: toggleAutostart } = require('./system/autostart');
const log = require('./logger');

let tray = null;

function createTrayIcon(color) {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4, 0);
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;

  function setPixel(x, y) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    canvas[idx] = r; canvas[idx + 1] = g; canvas[idx + 2] = b; canvas[idx + 3] = 255;
  }

  // Simple "P" shape for PC-Pilot
  for (let y = 2; y <= 13; y++) setPixel(4, y); // vertical bar
  for (let x = 4; x <= 10; x++) { setPixel(x, 2); setPixel(x, 7); } // top + mid horizontal
  for (let y = 2; y <= 7; y++) setPixel(10, y); // right vertical
  // dot
  setPixel(7, 10); setPixel(8, 10); setPixel(7, 11); setPixel(8, 11);

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function initTray(app) {
  const icon = createTrayIcon(0x22c55e); // green = active
  tray = new Tray(icon);

  updateMenu();
  tray.setToolTip('PC-Pilot — Service running');

  watchConfig(() => updateMenu());

  return tray;
}

function updateMenu() {
  const config = getConfig();
  const localIP = getLocalIP();
  const port = config.server.port || 7042;
  const baseUrl = `http://${localIP}:${port}`;

  const endpointItems = [
    { label: 'POST /system/shutdown', click: () => clipboard.writeText(`curl -X POST ${baseUrl}/api/v1/system/shutdown -H "Authorization: Bearer ${config.security.token}"`) },
    { label: 'POST /system/reboot', click: () => clipboard.writeText(`curl -X POST ${baseUrl}/api/v1/system/reboot -H "Authorization: Bearer ${config.security.token}"`) },
    { label: 'POST /system/sleep', click: () => clipboard.writeText(`curl -X POST ${baseUrl}/api/v1/system/sleep -H "Authorization: Bearer ${config.security.token}"`) },
    { label: 'POST /system/lock', click: () => clipboard.writeText(`curl -X POST ${baseUrl}/api/v1/system/lock -H "Authorization: Bearer ${config.security.token}"`) },
    { label: 'GET  /system/status', click: () => clipboard.writeText(`curl ${baseUrl}/api/v1/system/status -H "Authorization: Bearer ${config.security.token}"`) },
    { label: 'GET  /health', click: () => clipboard.writeText(`curl ${baseUrl}/api/v1/health`) },
  ];

  // Add configured apps
  for (const app of config.apps || []) {
    endpointItems.push({
      label: `POST /apps/launch (${app.label || app.id})`,
      click: () => clipboard.writeText(`curl -X POST ${baseUrl}/api/v1/apps/launch -H "Authorization: Bearer ${config.security.token}" -H "Content-Type: application/json" -d "{\\"id\\":\\"${app.id}\\"}"`)
    });
  }

  // Add configured commands
  for (const cmd of config.commands || []) {
    endpointItems.push({
      label: `POST /commands/execute (${cmd.label || cmd.id})`,
      click: () => clipboard.writeText(`curl -X POST ${baseUrl}/api/v1/commands/execute -H "Authorization: Bearer ${config.security.token}" -H "Content-Type: application/json" -d "{\\"id\\":\\"${cmd.id}\\"}"`)
    });
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: `PC-Pilot — ${baseUrl}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Copy API token',
      click: () => {
        clipboard.writeText(config.security.token);
        log.info('Token copied to clipboard');
      },
    },
    {
      label: 'Copy service URL',
      click: () => {
        clipboard.writeText(baseUrl);
        log.info('URL copied to clipboard');
      },
    },
    { type: 'separator' },
    {
      label: 'Endpoints (click = copy curl)',
      submenu: endpointItems,
    },
    { type: 'separator' },
    {
      label: 'Open configuration',
      click: () => {
        const { shell } = require('electron');
        shell.openPath(getConfigPath());
      },
    },
    {
      label: 'Reload configuration',
      click: () => {
        reloadConfig();
        updateMenu();
        log.info('Configuration reloaded from tray');
      },
    },
    {
      label: 'Regenerate API token',
      click: () => {
        const newToken = regenerateToken();
        clipboard.writeText(newToken);
        updateMenu();
        log.info('Token regenerated and copied');
      },
    },
    { type: 'separator' },
    {
      label: `Start with system ${isAutostartEnabled() ? '(on)' : '(off)'}`,
      click: async () => {
        await toggleAutostart();
        updateMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        const { app } = require('electron');
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

module.exports = { initTray, updateMenu };
