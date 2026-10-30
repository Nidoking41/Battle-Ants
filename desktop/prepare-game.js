// Builds the web game with relative asset paths (so it works from a local
// folder instead of the website) and copies it into ./game for Electron.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const from = path.join(root, 'build');
const to = path.join(__dirname, 'game');

execSync('npm run build', {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PUBLIC_URL: '.', CI: 'false' },
});

fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });
console.log('Copied game build into desktop/game');
