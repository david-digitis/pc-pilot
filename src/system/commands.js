const { execFile } = require('child_process');
const os = require('os');
const log = require('../logger');

const isWindows = os.platform() === 'win32';

// Built-in system commands — cross-platform
const SYSTEM_COMMANDS = {
  shutdown: {
    label: 'Shut down',
    win32: { exe: 'shutdown', args: ['/s', '/t', '5', '/c', 'Shutdown requested by PC-Pilot'] },
    linux: { exe: 'systemctl', args: ['poweroff'] },
  },
  reboot: {
    label: 'Reboot',
    win32: { exe: 'shutdown', args: ['/r', '/t', '5', '/c', 'Reboot requested by PC-Pilot'] },
    linux: { exe: 'systemctl', args: ['reboot'] },
  },
  sleep: {
    label: 'Sleep',
    win32: { exe: 'powershell.exe', args: ['-NonInteractive', '-Command', 'Add-Type -Assembly System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState("Suspend", $false, $false)'] },
    linux: { exe: 'systemctl', args: ['suspend'] },
  },
  hibernate: {
    label: 'Hibernate',
    win32: { exe: 'shutdown', args: ['/h'] },
    linux: { exe: 'systemctl', args: ['hibernate'] },
  },
  lock: {
    label: 'Lock session',
    win32: { exe: 'rundll32.exe', args: ['user32.dll,LockWorkStation'] },
    linux: { exe: 'loginctl', args: ['lock-session'] },
  },
};

function executeSystemCommand(commandId) {
  return new Promise((resolve, reject) => {
    const cmd = SYSTEM_COMMANDS[commandId];
    if (!cmd) {
      return reject(new Error(`Unknown system command: ${commandId}`));
    }

    const platform = isWindows ? 'win32' : 'linux';
    const { exe, args } = cmd[platform];

    log.info({ command: commandId, exe }, 'Executing system command');

    // SECURITY: execFile, NOT exec. No shell interpolation.
    execFile(exe, args, { timeout: 15000, shell: false }, (err, stdout, stderr) => {
      if (err) {
        // Some commands (like shutdown) return non-zero but succeed
        if (commandId === 'shutdown' || commandId === 'reboot' || commandId === 'hibernate') {
          log.info({ command: commandId, exitCode: err.code }, 'Command initiated');
          return resolve({ success: true, message: `${cmd.label} initiated` });
        }
        log.error({ command: commandId, err: err.message }, 'Command failed');
        return reject(err);
      }

      log.info({ command: commandId }, 'Command OK');
      resolve({ success: true, message: cmd.label });
    });
  });
}

function getSystemCommands() {
  return Object.entries(SYSTEM_COMMANDS).map(([id, cmd]) => ({
    id,
    label: cmd.label,
  }));
}

module.exports = { executeSystemCommand, getSystemCommands, SYSTEM_COMMANDS };
