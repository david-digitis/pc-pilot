const { execFile } = require('child_process');
const os = require('os');

const isWindows = os.platform() === 'win32';

// Built-in system commands — cross-platform
const SYSTEM_COMMANDS = {
  shutdown: {
    label: 'Eteindre le PC',
    win32: { exe: 'shutdown', args: ['/s', '/t', '5', '/c', 'Arret demande par PC-Pilot'] },
    linux: { exe: 'systemctl', args: ['poweroff'] },
  },
  reboot: {
    label: 'Redemarrer le PC',
    win32: { exe: 'shutdown', args: ['/r', '/t', '5', '/c', 'Redemarrage demande par PC-Pilot'] },
    linux: { exe: 'systemctl', args: ['reboot'] },
  },
  sleep: {
    label: 'Mise en veille',
    win32: { exe: 'powershell.exe', args: ['-NonInteractive', '-Command', 'Add-Type -Assembly System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState("Suspend", $false, $false)'] },
    linux: { exe: 'systemctl', args: ['suspend'] },
  },
  hibernate: {
    label: 'Hibernation',
    win32: { exe: 'shutdown', args: ['/h'] },
    linux: { exe: 'systemctl', args: ['hibernate'] },
  },
  lock: {
    label: 'Verrouiller la session',
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

    console.log(`[System] Executing: ${commandId} (${exe} ${args.join(' ')})`);

    // SECURITY: execFile, NOT exec. No shell interpolation.
    execFile(exe, args, { timeout: 15000, shell: false }, (err, stdout, stderr) => {
      if (err) {
        // Some commands (like shutdown) return non-zero but succeed
        if (commandId === 'shutdown' || commandId === 'reboot' || commandId === 'hibernate') {
          console.log(`[System] ${commandId} initiated (exit code: ${err.code})`);
          return resolve({ success: true, message: `${cmd.label} initie` });
        }
        console.error(`[System] ${commandId} failed:`, err.message);
        return reject(err);
      }

      console.log(`[System] ${commandId} OK`);
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
