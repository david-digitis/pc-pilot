const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const log = require('./logger');

let config = null;
let configPath = null;

function getConfigDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'pc-pilot');
  }
  return path.join(os.homedir(), '.config', 'pc-pilot');
}

function getConfigPath() {
  if (!configPath) {
    configPath = path.join(getConfigDir(), 'config.json');
  }
  return configPath;
}

function getDefaults() {
  return {
    server: {
      port: 7042,
      host: '0.0.0.0',
    },
    security: {
      token: crypto.randomBytes(32).toString('hex'),
      allowedIPs: ['127.0.0.1', '::1'],
    },
    apps: [],
    commands: [],
    tray: {
      showNotifications: true,
    },
  };
}

function loadConfig() {
  const cfgPath = getConfigPath();
  const dir = path.dirname(cfgPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(cfgPath)) {
    const defaults = getDefaults();
    fs.writeFileSync(cfgPath, JSON.stringify(defaults, null, 2));
    config = defaults;
    log.info({ path: cfgPath }, 'Created default config');
    log.info({ token: `${config.security.token.substring(0, 8)}...` }, 'API token');
    return config;
  }

  const raw = fs.readFileSync(cfgPath, 'utf8');
  config = JSON.parse(raw);

  // Ensure token exists
  if (!config.security?.token) {
    config.security = config.security || {};
    config.security.token = crypto.randomBytes(32).toString('hex');
    saveConfig();
  }

  log.info({ path: cfgPath }, 'Config loaded');
  return config;
}

function saveConfig() {
  ignoreNextWatch = true;
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

let onReloadCallback = null;
let ignoreNextWatch = false;

function reloadConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    config = JSON.parse(raw);
    log.info('Config reloaded');
    if (onReloadCallback) onReloadCallback();
    return true;
  } catch (err) {
    log.error({ err: err.message }, 'Config reload failed');
    return false;
  }
}

function watchConfig(callback) {
  onReloadCallback = callback;
  let debounce = null;
  fs.watch(getConfigPath(), () => {
    if (ignoreNextWatch) {
      ignoreNextWatch = false;
      return;
    }
    clearTimeout(debounce);
    debounce = setTimeout(() => reloadConfig(), 300);
  });
  log.info('Watching config for changes');
}

function getConfig() {
  if (!config) loadConfig();
  return config;
}

function regenerateToken() {
  config.security.token = crypto.randomBytes(32).toString('hex');
  saveConfig();
  return config.security.token;
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

module.exports = { loadConfig, getConfig, saveConfig, regenerateToken, reloadConfig, watchConfig, getConfigPath, getConfigDir, getLocalIP };
