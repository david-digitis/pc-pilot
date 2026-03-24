# PC-PILOT

Service REST local pour controler un PC Windows/Linux depuis un systeme domotique (Gladys Assistant).

## Stack technique

- **Runtime** : Node.js 22 LTS
- **API** : Fastify 5.x
- **Tray** : Electron (mode tray-only, sans fenetre)
- **Packaging** : electron-builder (.exe Windows, .AppImage Linux)
- **Auto-start Windows** : nssm (service natif)
- **Auto-start Linux** : systemd user service + loginctl enable-linger

## Architecture

```
PC-PILOT/
├── main.js                     # Point d'entree Electron (tray-only)
├── package.json
├── src/
│   ├── server.js               # Serveur Fastify
│   ├── routes/
│   │   ├── system.js           # POST shutdown, reboot, sleep, hibernate, lock
│   │   ├── apps.js             # POST launch, kill / GET running, registered
│   │   ├── commands.js         # POST execute / GET list
│   │   └── meta.js             # GET health, endpoints, config, status
│   ├── middleware/
│   │   ├── auth.js             # Bearer token verification (timingSafeEqual)
│   │   └── ip-filter.js        # IP whitelist
│   ├── system/
│   │   ├── commands.js         # Abstraction cross-platform (shutdown, sleep, etc.)
│   │   ├── process-manager.js  # Launch/kill applications
│   │   └── status.js           # Uptime, RAM, CPU, OS info
│   ├── config.js               # Config loader + watcher + defaults
│   ├── tray.js                 # Tray icon et menu
│   └── logger.js               # Logging structure (pino)
├── assets/
│   └── icon.png                # Icone tray
└── CLAUDE.md
```

## API

Base URL : `http://{IP}:7042/api/v1`
Port par defaut : **7042**

### Endpoints

```
# Systeme
POST /api/v1/system/shutdown      Eteint le PC (delai 5s)
POST /api/v1/system/reboot        Redemarre
POST /api/v1/system/sleep         Mise en veille
POST /api/v1/system/hibernate     Hibernation
POST /api/v1/system/lock          Verrouille la session

# Applications
POST /api/v1/apps/launch          Body: { "id": "firefox" }
POST /api/v1/apps/kill            Body: { "id": "firefox" }
GET  /api/v1/apps/registered      Liste des apps configurees

# Commandes custom
POST /api/v1/commands/execute     Body: { "id": "backup-nas" }
GET  /api/v1/commands/list        Liste des commandes

# Meta
GET  /api/v1/health               Health check (SANS auth)
GET  /api/v1/system/status        Uptime, RAM, CPU, OS
GET  /api/v1/endpoints            Doc auto + commandes curl
```

## Securite — REGLES NON-NEGOCIABLES

1. **API key** : Bearer token 256 bits en header `Authorization`, comparaison `crypto.timingSafeEqual`
2. **IP whitelist** : Par defaut localhost + IP Gladys configurable
3. **Whitelist commandes** : L'API recoit un NOM de commande, JAMAIS une commande shell
4. **execFile uniquement** : Toujours `child_process.execFile()` avec `shell: false`, JAMAIS `exec()`
5. **Pas de CORS** : Ne pas installer de middleware CORS = CSRF bloque par le navigateur
6. **Firewall OS** : Regle pour restreindre le port au subnet LAN
7. **Rate limiting** : 30 req/min par IP via @fastify/rate-limit

## Config

Fichier : `%APPDATA%/pc-pilot/config.json` (Win) / `~/.config/pc-pilot/config.json` (Linux)

```json
{
  "server": { "port": 7042, "host": "0.0.0.0" },
  "security": {
    "token": "auto-generated-64-char-hex",
    "allowedIPs": ["127.0.0.1", "::1", "192.168.1.50"]
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

## Tray menu

```
PC-Pilot — En ecoute sur 192.168.1.x:7042
─────────────────────
Copier le token API
Copier l'URL du service
─────────────────────
Endpoints disponibles >
  POST /system/shutdown
  POST /system/reboot
  ...
─────────────────────
Ouvrir la configuration
Recharger la configuration
Regenerer le token API
─────────────────────
Demarrage automatique [x]
─────────────────────
Quitter
```

## Regles de dev

- **Pas de sur-ingenierie** : MVP first, on itere
- **Pas de CORS** : ne pas configurer = protection CSRF gratuite
- **execFile only** : jamais exec(), jamais shell: true
- **Token en config** : genere au premier lancement, affichable dans le tray
- **Logs** : pino JSON, jamais logger le token ou les payloads sensibles
- **Sleep Windows** : attention, `SetSuspendState` fait hibernate si hibernate est active

## Integration Gladys

```yaml
# Scene Gladys
trigger: voice_command "eteins le pc"
action:
  type: http_request
  method: POST
  url: http://192.168.1.100:7042/api/v1/system/shutdown
  headers:
    Authorization: Bearer <token>
```

## Builds

```bash
npm start              # Dev
npm run build:win      # -> .exe
npm run build:linux    # -> .AppImage
```
