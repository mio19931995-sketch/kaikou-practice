const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.join(__dirname, '..');
// Keep downloaded build tools and temporary extraction on the project drive.
// This avoids cross-volume renames with redirected Windows profile folders.
const cache = path.join(root, '.build-cache', 'electron-builder');
const temp = path.join(root, '.build-cache', 'temp');
fs.mkdirSync(cache, { recursive: true });
fs.mkdirSync(temp, { recursive: true });
const builderRoot = path.dirname(require.resolve('electron-builder/package.json'));
const bin = require('electron-builder/package.json').bin['electron-builder'];
const child = spawn(process.execPath, [path.join(builderRoot, bin), '--win', 'nsis', '--x64', ...process.argv.slice(2)], {
  cwd: root,
  env: { ...process.env, ELECTRON_BUILDER_CACHE: cache, TEMP: temp, TMP: temp },
  windowsHide: true,
  stdio: 'inherit',
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
