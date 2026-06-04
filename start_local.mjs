import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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
process.env.PGLITE_DB_PATH = path.join(__dirname, 'knowledge_base/pglite/data');
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

function runCmd(name, color, cwd, cmd, args) {
  return new Promise((resolve, reject) => {
    // shell: true is needed for Windows to find npm, python, etc. correctly
    const p = spawn(cmd, args, { cwd, env: process.env, shell: true });
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
      if (code === 0) resolve();
      else reject(new Error(`Exited with code ${code}`));
    });
  });
}

async function startPythonService(name, color, dir, port) {
  const fullDir = path.join(__dirname, dir);
  const venvDir = path.join(fullDir, 'venv');
  const pythonExe = path.join(venvDir, 'Scripts', 'python.exe');
  const pipExe = path.join(venvDir, 'Scripts', 'pip.exe');

  try {
    if (!fs.existsSync(venvDir)) {
      console.log(`${color}[${name}]\x1b[0m Creating virtualenv...`);
      await runCmd(name, color, fullDir, 'python', ['-m', 'venv', 'venv']);
    }
    
    // console.log(`${color}[${name}]\x1b[0m Installing requirements...`);
    await runCmd(name, color, fullDir, pipExe, ['install', '-r', 'requirements.txt', '--quiet']);

    console.log(`${color}[${name}]\x1b[0m Starting uvicorn...`);
    const appTarget = name === 'Orchestrator' ? 'main:app' : 'server:app';
    runCmd(name, color, fullDir, pythonExe, ['-m', 'uvicorn', appTarget, '--host', '0.0.0.0', '--port', port.toString()]);
  } catch (err) {
    console.error(`${color}[${name}]\x1b[0m Failed: ${err.message}`);
  }
}

async function startNodeService(name, color, dir, cmd, args) {
  const fullDir = path.join(__dirname, dir);
  try {
    if (!fs.existsSync(path.join(fullDir, 'node_modules'))) {
      console.log(`${color}[${name}]\x1b[0m Running npm install...`);
      await runCmd(name, color, fullDir, 'npm', ['install']);
    }
    console.log(`${color}[${name}]\x1b[0m Starting service...`);
    runCmd(name, color, fullDir, cmd, args);
  } catch (err) {
    console.error(`${color}[${name}]\x1b[0m Failed: ${err.message}`);
  }
}

async function main() {
  startNodeService('DB:PGlite', '\x1b[33m', 'knowledge_base/pglite', 'node', ['server.mjs']);
  startNodeService('Dashboard', '\x1b[36m', 'dashboard', 'npm', ['run', 'dev']);
  startPythonService('Orchestrator', '\x1b[35m', 'orchestrator', 8000);

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

process.on('SIGINT', () => {
  console.log("\nStopping all services...");
  procs.forEach(p => {
    try { p.kill('SIGKILL'); } catch (e) {}
  });
  process.exit();
});
