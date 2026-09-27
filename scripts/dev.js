import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const nodeCmd = isWindows ? 'node.exe' : 'node';

console.log('\x1b[36m%s\x1b[0m', '🚀 Starting Flux Full Application (Backend + Frontend Dev Mode)...');

// Start backend
const backend = spawn(`${nodeCmd} src/index.js`, {
  cwd: backendDir,
  shell: true,
  stdio: 'pipe',
  env: { ...process.env, FORCE_COLOR: '1' },
});

// Start frontend
const frontend = spawn(`${npmCmd} run dev`, {
  cwd: frontendDir,
  shell: true,
  stdio: 'pipe',
  env: { ...process.env, FORCE_COLOR: '1' },
});

function prefixOutput(stream, prefix, colorCode) {
  if (!stream) return;
  stream.on('data', data => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`\x1b[${colorCode}m[${prefix}]\x1b[0m ${line}`);
      }
    });
  });
}

prefixOutput(backend.stdout, 'BACKEND', '33'); // Yellow
prefixOutput(backend.stderr, 'BACKEND:ERR', '31'); // Red

prefixOutput(frontend.stdout, 'FRONTEND', '32'); // Green
prefixOutput(frontend.stderr, 'FRONTEND:ERR', '31'); // Red

function cleanup() {
  console.log('\n\x1b[36m%s\x1b[0m', '🛑 Stopping Flux processes...');
  try { backend.kill(); } catch {}
  try { frontend.kill(); } catch {}
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
