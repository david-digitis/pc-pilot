const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const log = require('../logger');

const isWindows = os.platform() === 'win32';
const APP_NAME = 'PC-Pilot';

function getStartupPath() {
  if (isWindows) {
    return path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', `${APP_NAME}.lnk`);
  }
  return path.join(os.homedir(), '.config', 'autostart', `${APP_NAME.toLowerCase()}.desktop`);
}

function getExePath() {
  // In dev: electron path, in prod: the built .exe
  return process.execPath;
}

function isEnabled() {
  return fs.existsSync(getStartupPath());
}

function enable() {
  if (isWindows) {
    // Create .lnk shortcut via PowerShell
    const target = getExePath();
    const appDir = path.dirname(process.execPath);
    const lnkPath = getStartupPath();
    const ps = `$s=(New-Object -COM WScript.Shell).CreateShortcut('${lnkPath.replace(/'/g, "''")}');$s.TargetPath='${target.replace(/'/g, "''")}';$s.WorkingDirectory='${appDir.replace(/'/g, "''")}';$s.Save()`;

    return new Promise((resolve, reject) => {
      execFile('powershell.exe', ['-NonInteractive', '-Command', ps], { shell: false }, (err) => {
        if (err) return reject(err);
        log.info('Autostart enabled');
        resolve(true);
      });
    });
  }

  // Linux: .desktop file
  const desktopDir = path.dirname(getStartupPath());
  if (!fs.existsSync(desktopDir)) fs.mkdirSync(desktopDir, { recursive: true });

  const content = `[Desktop Entry]
Type=Application
Name=${APP_NAME}
Exec=${getExePath()}
X-GNOME-Autostart-enabled=true
`;
  fs.writeFileSync(getStartupPath(), content);
  log.info('Autostart enabled');
  return Promise.resolve(true);
}

function disable() {
  const p = getStartupPath();
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    log.info('Autostart disabled');
  }
  return Promise.resolve(false);
}

async function toggle() {
  if (isEnabled()) {
    return disable();
  }
  return enable();
}

module.exports = { isEnabled, enable, disable, toggle };
