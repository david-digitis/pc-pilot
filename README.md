# PC-Pilot

Local REST service to control a Windows/Linux PC from a home automation system.

Built for [Gladys Assistant](https://gladysassistant.com), compatible with any system that can send HTTP requests.

## Features

- **System commands**: shutdown, reboot, sleep, hibernate, lock
- **App launcher**: start/stop configured applications
- **Custom commands**: run pre-configured scripts (backup, etc.)
- **System tray**: tray icon with quick access to all features
- **Security**: API token, IP whitelist, rate limiting

## Installation

### Requirements

- [Node.js 22 LTS](https://nodejs.org/)

### Development

```bash
git clone https://github.com/david-digitis/pc-pilot.git
cd pc-pilot
npm install
npm start
```

On first launch, a configuration file is created automatically:
- **Windows**: `%APPDATA%/pc-pilot/config.json`
- **Linux**: `~/.config/pc-pilot/config.json`

An API token is generated automatically. You can copy it from the tray menu (right-click the icon).

## Configuration

### config.json

```json
{
  "server": {
    "port": 7042,
    "host": "0.0.0.0"
  },
  "security": {
    "token": "your-auto-generated-token",
    "allowedIPs": ["127.0.0.1", "::1", "192.168.1.50"]
  },
  "apps": [
    {
      "id": "firefox",
      "label": "Firefox",
      "path": {
        "win32": "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
        "linux": "/usr/bin/firefox"
      }
    }
  ],
  "commands": [
    {
      "id": "backup-nas",
      "label": "Backup NAS",
      "command": { "win32": "robocopy", "linux": "rsync" },
      "args": {
        "win32": ["C:\\Users\\David\\Documents", "\\\\NAS\\backup"],
        "linux": ["-avz", "~/Documents/", "nas:/backup/"]
      },
      "timeout": 300000
    }
  ]
}
```

### allowedIPs

List of IP addresses allowed to contact the API. **Must be an array.**

Add at minimum:
- `127.0.0.1` and `::1` (localhost)
- Your home automation system's IP (e.g. `192.168.10.200`)
- Your PC's LAN IP if you test locally via network IP

> If the array is empty, all IPs are allowed (not recommended).

### Firewall

If your home automation system runs on a different machine, open the port in Windows Firewall:

```bash
netsh advfirewall firewall add rule name="PC-Pilot" dir=in action=allow protocol=TCP localport=7042 remoteip=192.168.10.200
```

Replace `192.168.10.200` with your home automation system's IP.

## API

Base URL: `http://<IP>:7042/api/v1`

All routes (except `/health`) require the header:
```
Authorization: Bearer <your-token>
```

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/system/shutdown` | Shut down the PC (5s delay) |
| POST | `/api/v1/system/reboot` | Reboot the PC |
| POST | `/api/v1/system/sleep` | Suspend / sleep |
| POST | `/api/v1/system/hibernate` | Hibernate |
| POST | `/api/v1/system/lock` | Lock the session |
| GET | `/api/v1/system/status` | System info (uptime, RAM, CPU) |

### Applications

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/apps/launch` | `{ "id": "firefox" }` | Launch a configured app |
| POST | `/api/v1/apps/kill` | `{ "id": "firefox" }` | Kill a running app |
| GET | `/api/v1/apps/registered` | — | List configured apps |

### Custom commands

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/commands/execute` | `{ "id": "backup-nas" }` | Run a configured command |
| GET | `/api/v1/commands/list` | — | List available commands |

### Meta

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/health` | No | Health check |
| GET | `/api/v1/endpoints` | Yes | List all endpoints with curl examples |

## Gladys Assistant Integration

### 1. Get the token

Right-click the PC-Pilot tray icon > **Copy API token**.

### 2. Create a scene

In Gladys, create a scene with the **Make an HTTP request** action:

| Field | Value |
|-------|-------|
| **Method** | `POST` |
| **URL** | `http://<PC-IP>:7042/api/v1/system/lock` |
| **Header 1** | `Authorization` : `Bearer <your-token>` |
| **Header 2** | `Content-Type` : `application/json` |
| **Body** | `{}` |

> **Important**: the `{}` body is required even for commands that don't need one. Without it, Gladys will return an error.

![Gladys HTTP request configuration](doc/config-gladys-http.png)

### 3. Scene examples

**Shut down PC by voice command:**
```yaml
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

**Lock PC when leaving home:**
```yaml
trigger: user_left_home
action:
  type: http_request
  method: POST
  url: http://192.168.1.100:7042/api/v1/system/lock
  headers:
    Authorization: Bearer <token>
    Content-Type: application/json
  body: {}
```

## Tray menu

The tray icon gives access to:
- Copy API token
- Copy service URL
- Copy curl commands for each endpoint
- Open configuration file
- Regenerate API token

## Security

- **API token**: 256-bit, constant-time comparison (`timingSafeEqual`)
- **IP whitelist**: only configured IPs can reach the API
- **Command whitelist**: the API receives an identifier, never a shell command
- **execFile**: no shell interpretation (`shell: false`), no injection possible
- **Rate limiting**: 30 requests/minute per IP
- **No CORS**: built-in CSRF protection

## Tech stack

- **Runtime**: Node.js 22 LTS
- **API**: Fastify 5
- **Tray**: Electron (tray-only mode)
- **Packaging**: electron-builder

## License

MIT
