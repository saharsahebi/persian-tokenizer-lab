import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backendDirectory = join(projectRoot, 'backend');
const frontendDirectory = join(projectRoot, 'frontend');
const environmentPython = process.platform === 'win32'
  ? join(backendDirectory, '.venv', 'Scripts', 'python.exe')
  : join(backendDirectory, '.venv', 'bin', 'python');
const bundledPython = join(projectRoot, '.runtime', 'python312', 'python.exe');
const pythonExecutable = existsSync(environmentPython)
  ? environmentPython
  : process.platform === 'win32' && existsSync(bundledPython)
    ? bundledPython
    : environmentPython;
const viteExecutable = join(frontendDirectory, 'node_modules', 'vite', 'bin', 'vite.js');
const children = [];
let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === 'win32') {
      spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } else {
      child.kill('SIGTERM');
    }
  }
  process.exitCode = exitCode;
  setTimeout(() => process.exit(exitCode), 700).unref();
}

function launch(label, executable, args, cwd) {
  const child = spawn(executable, args, { cwd, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.once('error', (error) => {
    console.error(`[${label}] ${error.message}`);
    stop(1);
  });
  child.once('exit', (code, signal) => {
    if (stopping) return;
    console.error(`[${label}] stopped (${signal ?? code ?? 'unknown'}).`);
    stop(code === 0 ? 0 : 1);
  });
}

async function checkPort(port) {
  await new Promise((resolvePort, rejectPort) => {
    const probe = createServer();
    probe.once('error', () => rejectPort(new Error(
      `Port ${port} is already in use. Close the previous TokenNama terminal or the application using that port.`,
    )));
    probe.listen(port, '127.0.0.1', () => probe.close(resolvePort));
  });
}

if (!existsSync(pythonExecutable) || !existsSync(viteExecutable)) {
  console.error('Dependencies are missing. Run scripts/setup.ps1 before starting TokenNama.');
  process.exitCode = 1;
} else {
  try {
    await checkPort(8000);
    await checkPort(5173);
    console.log('TokenNama | Persian Tokenizer Lab');
    console.log('Application: http://127.0.0.1:5173');
    console.log('API documentation: http://127.0.0.1:8000/docs');
    console.log('Press Ctrl+C in this terminal to stop both servers.');
    launch('API', pythonExecutable, [
      '-m', 'uvicorn', 'tokenizer_lab.main:app', '--host', '127.0.0.1', '--port', '8000',
    ], backendDirectory);
    const viteArguments = [viteExecutable, '--configLoader', 'runner', '--host', '127.0.0.1', '--port', '5173', '--strictPort'];
    if (process.argv.includes('--open')) viteArguments.push('--open');
    launch('Web', process.execPath, viteArguments, frontendDirectory);
    process.on('SIGINT', () => stop());
    process.on('SIGTERM', () => stop());
    if (process.platform === 'win32') process.on('SIGBREAK', () => stop());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
