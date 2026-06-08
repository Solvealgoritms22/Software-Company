import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import net from 'net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      const firstEq = line.indexOf('=');
      if (firstEq === -1) continue;
      const key = line.slice(0, firstEq).trim();
      let value = line.slice(firstEq + 1).trim();
      // Strip optional quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch (err) {
    console.error(`[EnvLoader] Failed to load env file ${filePath}:`, err.message);
  }
}

// Load configurations from env files
loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, 'config', 'secrets.runtime.env'));

const workspacePath = process.platform === 'win32'
  ? 'C:\\ProgramData\\Software-Company\\workspace'
  : path.join(__dirname, '.local', 'workspace');

if (!fs.existsSync(workspacePath)) {
  fs.mkdirSync(workspacePath, { recursive: true });
}
process.env.WORKSPACE_ROOT = workspacePath;
process.env.DEPLOY_WORKSPACE_ROOT = workspacePath;
process.env.SECURITY_WORKSPACE_ROOT = workspacePath;
process.env.KNOWLEDGE_DB_PORT = "5432";
process.env.KNOWLEDGE_DB_HOST = "localhost";
const dbPath = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\default', 'AppData', 'Local'), 'Software-Company', 'db')
  : path.join(process.env.HOME || process.env.USERPROFILE || '~', '.local', 'share', 'Software-Company', 'db');

if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}
process.env.PGLITE_DB_PATH = dbPath;
process.env.GITHUB_MCP_URL = "http://localhost:8010";
process.env.JIRA_MCP_URL = "http://localhost:8011";
process.env.CONFLUENCE_MCP_URL = "http://localhost:8012";
process.env.GOOGLE_DRIVE_MCP_URL = "http://localhost:8013";
process.env.DEPLOY_MCP_URL = "http://localhost:8014";
process.env.PLAYWRIGHT_MCP_URL = "http://localhost:8015";
process.env.SECURITY_MCP_URL = "http://localhost:8016";
process.env.WORKSPACE_TOOLS_MCP_URL = "http://localhost:8017";
process.env.PYTHONUNBUFFERED = "1";
process.env.FORCE_COLOR = "1";

console.log("\x1b[36m=========================================\x1b[0m");
console.log("\x1b[36m Starting Software Company (Local Mode)  \x1b[0m");
console.log("\x1b[36m=========================================\x1b[0m\n");
console.log("Press Ctrl+C to stop all services.\n");

const procs = [];
let shuttingDown = false;

function forgetProcess(proc) {
  const index = procs.indexOf(proc);
  if (index !== -1) {
    procs.splice(index, 1);
  }
}

function killProcessTree(proc) {
  if (!proc || proc.killed || !proc.pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      try {
        process.kill(-proc.pid, 'SIGTERM');
      } catch {
        proc.kill('SIGTERM');
      }
    }
  } catch {
    // Process may already be gone.
  }
}

function shutdown(reason, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nStopping all services (${reason})...`);
  for (const proc of [...procs]) {
    killProcessTree(proc);
  }
  setTimeout(() => process.exit(exitCode), 750).unref();
}

function runCmd(name, color, cwd, cmd, args, options = {}) {
  const { rejectOnExit = true } = options;
  return new Promise((resolve, reject) => {
    // shell: true is needed for Windows to find npm, python, etc. correctly
    const p = spawn(cmd, args, {
      cwd,
      env: process.env,
      shell: true,
      windowsHide: true,
      detached: process.platform !== 'win32',
    });
    procs.push(p);

    p.stdout.on('data', data => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) console.log(`${color}[${name}]\x1b[0m ${line.replace(/\r/g, '')}`);
      });
    });

    p.stderr.on('data', data => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) console.error(`${color}[${name}]\x1b[0m ${line.replace(/\r/g, '')}`);
      });
    });

    p.on('close', code => {
      forgetProcess(p);
      if (code === 0) resolve();
      else if (rejectOnExit) reject(new Error(`Exited with code ${code}`));
      else {
        console.error(`${color}[${name}]\x1b[0m Process exited with code ${code}.`);
        resolve();
      }
    });
  });
}

function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
    socket.connect(port, host);
  });
}

async function startPythonService(name, color, dir, port) {
  const fullDir = path.join(__dirname, dir);
  const venvDir = path.join(fullDir, 'venv');
  const pythonExe = path.join(venvDir, 'Scripts', 'python.exe');
  const pipExe = path.join(venvDir, 'Scripts', 'pip.exe');

  try {
    if (await isPortInUse(port)) {
      console.log(`${color}[${name}]\x1b[0m Port ${port} is already in use. Reusing the running service.`);
      return;
    }

    if (!fs.existsSync(venvDir)) {
      console.log(`${color}[${name}]\x1b[0m Creating virtualenv...`);
      await runCmd(name, color, fullDir, 'python', ['-m', 'venv', 'venv']);
    }
    
    // console.log(`${color}[${name}]\x1b[0m Installing requirements...`);
    await runCmd(name, color, fullDir, pipExe, ['install', '-r', 'requirements.txt', '--quiet']);

    console.log(`${color}[${name}]\x1b[0m Starting uvicorn...`);
    const appTarget = name === 'Orchestrator' ? 'main:app' : 'server:app';
    void runCmd(name, color, fullDir, pythonExe, ['-m', 'uvicorn', appTarget, '--host', '0.0.0.0', '--port', port.toString()], { rejectOnExit: false });
  } catch (err) {
    console.error(`${color}[${name}]\x1b[0m Failed: ${err.message}`);
  }
}

async function startNodeService(name, color, dir, cmd, args, port) {
  const fullDir = path.join(__dirname, dir);
  try {
    if (port && await isPortInUse(port)) {
      console.log(`${color}[${name}]\x1b[0m Port ${port} is already in use. Reusing the running service.`);
      return;
    }

    if (!fs.existsSync(path.join(fullDir, 'node_modules'))) {
      console.log(`${color}[${name}]\x1b[0m Running npm install...`);
      await runCmd(name, color, fullDir, 'npm', ['install']);
    }
    console.log(`${color}[${name}]\x1b[0m Starting service...`);
    void runCmd(name, color, fullDir, cmd, args, { rejectOnExit: false });
  } catch (err) {
    console.error(`${color}[${name}]\x1b[0m Failed: ${err.message}`);
  }
}

async function main() {
  startNodeService('DB:PGlite', '\x1b[33m', 'knowledge_base/pglite', 'node', ['server.mjs'], 5432);
  startNodeService('Dashboard', '\x1b[36m', 'dashboard', 'npm', ['run', 'dev'], Number(process.env.DASHBOARD_PORT || 3000));
  startPythonService('Orchestrator', '\x1b[35m', 'orchestrator', 8000);
  if (process.env.NEXT_PUBLIC_MINIVERSE_URL) {
    startNodeService('Miniverse', '\x1b[94m', 'my-world', 'npm', ['run', 'dev'], 4321);
  } else {
    console.log("Miniverse office mode is disabled. Skipping Miniverse startup.");
  }

  const mcps = [
    { name: 'github', port: 8010 },
    { name: 'jira', port: 8011 },
    { name: 'confluence', port: 8012 },
    { name: 'google_drive', port: 8013 },
    { name: 'deploy', port: 8014 },
    { name: 'playwright', port: 8015 },
    { name: 'security', port: 8016 },
    { name: 'workspace_tools', port: 8017 },
  ];

  const colors = ['\x1b[31m', '\x1b[32m', '\x1b[94m', '\x1b[95m', '\x1b[96m', '\x1b[91m', '\x1b[92m', '\x1b[93m'];

  for (let i = 0; i < mcps.length; i++) {
    startPythonService(`MCP:${mcps[i].name}`, colors[i % colors.length], `mcp_servers/${mcps[i].name}`, mcps[i].port);
  }
}

main();

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGHUP', () => shutdown('SIGHUP'));
process.on('uncaughtException', (err) => {
  console.error(err);
  shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (err) => {
  console.error(err);
  shutdown('unhandledRejection', 1);
});
