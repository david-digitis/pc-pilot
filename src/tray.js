const { Tray, Menu, clipboard, nativeImage, BrowserWindow, ipcMain } = require('electron');
const { getConfig, saveConfig, regenerateToken, reloadConfig, watchConfig, getConfigPath, getLocalIP } = require('./config');
const { isEnabled: isAutostartEnabled, toggle: toggleAutostart } = require('./system/autostart');
const log = require('./logger');

let tray = null;
let promptWindow = null;

function promptForIP() {
  return new Promise((resolve) => {
    if (promptWindow) {
      promptWindow.focus();
      return resolve(null);
    }

    promptWindow = new BrowserWindow({
      width: 380,
      height: 180,
      resizable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      title: 'PC-Pilot — Add allowed IP',
      webPreferences: { nodeIntegration: true, contextIsolation: false },
    });

    promptWindow.setMenuBarVisibility(false);

    const html = `<!DOCTYPE html>
<html><head><style>
  body { font-family: Segoe UI, sans-serif; background: #1e1e2e; color: #cdd6f4; padding: 16px; margin: 0; }
  input { width: 100%; padding: 8px; font-size: 15px; border: 1px solid #45475a; border-radius: 6px; background: #313244; color: #cdd6f4; box-sizing: border-box; outline: none; }
  input:focus { border-color: #22c55e; }
  .btns { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
  button { padding: 8px 20px; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
  .ok { background: #22c55e; color: #1e1e2e; font-weight: 600; }
  .cancel { background: #45475a; color: #cdd6f4; }
</style></head><body>
  <label>IP address to allow:</label><br><br>
  <input id="ip" type="text" placeholder="192.168.1.50" autofocus>
  <div class="btns">
    <button class="cancel" onclick="cancel()">Cancel</button>
    <button class="ok" onclick="submit()">Add</button>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    const input = document.getElementById('ip');
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') cancel(); });
    function submit() { const v = input.value.trim(); if (v) ipcRenderer.send('prompt-ip-result', v); }
    function cancel() { ipcRenderer.send('prompt-ip-result', null); }
  </script>
</body></html>`;

    promptWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    ipcMain.once('prompt-ip-result', (_, ip) => {
      promptWindow.close();
      resolve(ip);
    });

    promptWindow.on('closed', () => {
      promptWindow = null;
      resolve(null);
    });
  });
}

function addAllowedIP(ip) {
  const config = getConfig();
  if (!Array.isArray(config.security.allowedIPs)) {
    config.security.allowedIPs = [];
  }
  if (!config.security.allowedIPs.includes(ip)) {
    config.security.allowedIPs.push(ip);
    saveConfig();
    updateMenu();
    log.info({ ip }, 'Allowed IP added');
  }
}

function removeAllowedIP(ip) {
  const config = getConfig();
  config.security.allowedIPs = (config.security.allowedIPs || []).filter(i => i !== ip);
  saveConfig();
  updateMenu();
  log.info({ ip }, 'Allowed IP removed');
}

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
      label: 'Allowed IPs',
      submenu: [
        ...(config.security.allowedIPs || []).map(ip => ({
          label: ip,
          submenu: [
            { label: 'Remove', click: () => removeAllowedIP(ip) },
          ],
        })),
        { type: 'separator' },
        {
          label: 'Add IP...',
          click: async () => {
            const ip = await promptForIP();
            if (ip) addAllowedIP(ip);
          },
        },
      ],
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
        try {
          await toggleAutostart();
        } catch (err) {
          log.error({ err: err.message }, 'Autostart toggle failed');
        }
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
