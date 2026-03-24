// Removes ELECTRON_RUN_AS_NODE (set by VS Code terminal) then spawns Electron
delete process.env.ELECTRON_RUN_AS_NODE;

const { execFileSync } = require('child_process');
const path = require('path');
const electronPath = require('electron');

execFileSync(electronPath, ['.'], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: process.env,
});
