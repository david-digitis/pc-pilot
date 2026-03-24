# PC-PILOT

Local REST service to control a Windows/Linux PC from a home automation system (Gladys Assistant).

## Tech stack

- **Runtime**: Node.js 22 LTS
- **API**: Fastify 5.x
- **Tray**: Electron (tray-only, no window)
- **Packaging**: electron-builder (.exe Windows, .AppImage + .rpm Linux)
- **Auto-start Windows**: Startup folder shortcut (via PowerShell)
- **Auto-start Linux**: .desktop file in ~/.config/autostart/
- **Logger**: pino (JSON structured logging)

## Architecture

```
PC-PILOT/
├── main.js                     # Electron entry point (tray-only)
├── package.json
├── scripts/
│   ├── launch.js               # Dev launcher (fixes ELECTRON_RUN_AS_NODE)
│   ├── build-rpm.sh            # RPM builder (Fedora/RHEL, bypasses fpm)
│   └── generate-icon.js        # Generates icon.ico and icon.png
├── src/
│   ├── server.js               # Fastify server
│   ├── routes/
│   │   ├── system.js           # POST shutdown, reboot, sleep, hibernate, lock
│   │   ├── apps.js             # POST launch, kill / GET registered
│   │   ├── commands.js         # POST execute / GET list
│   │   └── meta.js             # GET health, endpoints
│   ├── middleware/
│   │   ├── auth.js             # Bearer token verification (timingSafeEqual)
│   │   └── ip-filter.js        # IP whitelist
│   ├── system/
│   │   ├── commands.js         # Cross-platform system commands (shutdown, sleep, etc.)
│   │   ├── process-manager.js  # Launch/kill applications
│   │   ├── status.js           # Uptime, RAM, CPU, OS info
│   │   └── autostart.js        # Start with system toggle
│   ├── config.js               # Config loader + watcher + defaults
│   ├── tray.js                 # Tray icon, menu, IP management dialog
│   └── logger.js               # pino logger
├── assets/
│   ├── icon.ico                # Windows build icon (256x256)
│   └── icon.png                # Linux build icon (256x256)
├── doc/                        # Screenshots and forum post
└── CLAUDE.md
```

## API

Base URL: `http://{IP}:7042/api/v1`
Default port: **7042**

### Endpoints

```
# System
POST /api/v1/system/shutdown      Shut down the PC (5s delay)
POST /api/v1/system/reboot        Reboot
POST /api/v1/system/sleep         Sleep / suspend
POST /api/v1/system/hibernate     Hibernate
POST /api/v1/system/lock          Lock session

# Applications
POST /api/v1/apps/launch          Body: { "id": "firefox" }
POST /api/v1/apps/kill            Body: { "id": "firefox" }
GET  /api/v1/apps/registered      List configured apps

# Custom commands
POST /api/v1/commands/execute     Body: { "id": "backup-nas" }
GET  /api/v1/commands/list        List commands

# Meta
GET  /api/v1/health               Health check (NO auth)
GET  /api/v1/system/status        Uptime, RAM, CPU, OS
GET  /api/v1/endpoints            Auto-doc with curl commands
```

## Security — NON-NEGOTIABLE RULES

1. **API key**: Bearer token 256 bits in `Authorization` header, compared with `crypto.timingSafeEqual`
2. **IP whitelist**: Default localhost only, configurable from tray menu
3. **Command whitelist**: API receives a command NAME, NEVER a shell command
4. **execFile only**: Always `child_process.execFile()` with `shell: false`, NEVER `exec()`
5. **No CORS**: No CORS middleware = CSRF blocked by browser
6. **Firewall OS**: Rule to restrict port to LAN subnet
7. **Rate limiting**: 30 req/min per IP via @fastify/rate-limit
8. **Never log token or sensitive payloads**

## Config

File: `%APPDATA%/pc-pilot/config.json` (Win) / `~/.config/pc-pilot/config.json` (Linux)

```json
{
  "server": { "port": 7042, "host": "0.0.0.0" },
  "security": {
    "token": "auto-generated-64-char-hex",
    "allowedIPs": ["127.0.0.1", "::1"]
  },
  "apps": [
    { "id": "firefox", "label": "Firefox",
      "path": { "win32": "C:\\...\\firefox.exe", "linux": "/usr/bin/firefox" } }
  ],
  "commands": [
    { "id": "backup-nas", "label": "Backup NAS",
      "command": { "win32": "robocopy", "linux": "rsync" },
      "args": { "win32": ["C:\\Users\\David\\Documents", "\\\\NAS\\backup"], "linux": ["-avz", "~/Documents/", "nas:/backup/"] },
      "timeout": 300000 }
  ]
}
```

Config is auto-reloaded on file change (fs.watch) and can be reloaded from tray menu.
Allowed IPs can be managed directly from the tray menu (add/remove without editing JSON).

## Tray menu

```
PC-Pilot — http://192.168.x.x:7042
─────────────────────
Copy API token
Copy service URL
─────────────────────
Allowed IPs >
  127.0.0.1 > [Remove]
  ::1 > [Remove]
  192.168.x.x > [Remove]
  Add IP...
─────────────────────
Endpoints (click = copy curl) >
  POST /system/shutdown
  POST /system/reboot
  ...
─────────────────────
Open configuration
Reload configuration
Regenerate API token
─────────────────────
Start with system (on/off)
─────────────────────
Quit
```

## Dev rules

- **No over-engineering**: MVP first, iterate
- **No CORS**: not configuring = free CSRF protection
- **execFile only**: never exec(), never shell: true
- **Token in config**: generated on first launch, viewable from tray
- **Logs**: pino JSON, never log token or sensitive payloads
- **Sleep Windows**: uses PowerShell SetSuspendState (not rundll32)

## Gladys integration

```yaml
# Gladys scene
trigger: voice_command "turn off the pc"
action:
  type: http_request
  method: POST
  url: http://192.168.1.100:7042/api/v1/system/shutdown
  headers:
    Authorization: Bearer <token>
    Content-Type: application/json
  body: {}
```

**Important**: Gladys requires a `{}` body even for endpoints that don't need one.

## Builds

```bash
npm start              # Dev (handles VS Code ELECTRON_RUN_AS_NODE)
npm run build:win      # -> .exe installer in dist/
npm run build:linux    # -> .AppImage + .rpm in dist/
```

### Linux-specific notes

- **Sandbox**: `app.commandLine.appendSwitch('no-sandbox')` on Linux (avoids suid chrome-sandbox)
- **RPM build**: electron-builder's bundled fpm is incompatible with RPM 6 (Fedora 43+), so `scripts/build-rpm.sh` builds RPM from `dist/linux-unpacked/` using native `rpmbuild`
- **RPM requires**: `rpm-build` and `libxcrypt-compat` packages on the build machine
- **ELECTRON_RUN_AS_NODE**: VS Code terminal sets this env var, which makes packaged Electron binaries run as plain Node.js. The `.desktop` file clears it explicitly
