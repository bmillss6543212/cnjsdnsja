const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const serverEntry = path.join(projectRoot, 'server.js');
const socketClientEntry = path.join(projectRoot, 'admin', 'node_modules', 'socket.io-client', 'build', 'cjs', 'index.js');
const dataFilePath = path.join(projectRoot, 'tmp', `smoke-${process.pid}.json`);

const port = 3100 + Math.floor(Math.random() * 300);
const baseUrl = `http://127.0.0.1:${port}`;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // ignore until timeout
    }
    await delay(200);
  }
  throw new Error(`server did not become ready within ${timeoutMs}ms`);
}

async function main() {
  if (!require('fs').existsSync(socketClientEntry)) {
    throw new Error(`socket.io-client not found at ${socketClientEntry}`);
  }

  const server = spawn(process.execPath, [serverEntry], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'smoke-test-password',
      DISCORD_WEBHOOK_URL: '',
      DATA_FILE: dataFilePath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  server.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForServer(`${baseUrl}/`);

    const rootResponse = await fetch(`${baseUrl}/`);
    const rootHtml = await rootResponse.text();
    if (!rootResponse.ok || !rootHtml.includes('Socket.io Server Running')) {
      throw new Error('unexpected root response');
    }

    const adminResponse = await fetch(`${baseUrl}/admin`);
    if (!adminResponse.ok) {
      throw new Error(`admin route failed with status ${adminResponse.status}`);
    }

    const { io } = require(socketClientEntry);
    const socket = io(baseUrl, {
      transports: ['websocket'],
      timeout: 5000,
      forceNew: true,
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('socket connect timeout')), 5000);
      socket.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.on('connect_error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    const attachResult = await new Promise((resolve, reject) => {
      socket.emit('attach-client', { clientId: 'smoke-client' }, (payload) => {
        if (!payload || payload.ok !== true) {
          reject(new Error(`attach-client failed: ${JSON.stringify(payload)}`));
          return;
        }
        resolve(payload);
      });
    });

    const registerResult = await new Promise((resolve, reject) => {
      socket.emit('register-user', { clientId: 'smoke-client' }, (payload) => {
        if (!payload || payload.ok !== true) {
          reject(new Error(`register-user failed: ${JSON.stringify(payload)}`));
          return;
        }
        resolve(payload);
      });
    });

    if (!attachResult || !registerResult) {
      throw new Error('socket flow did not return expected payloads');
    }

    socket.disconnect();
    console.log('smoke-test passed');
  } finally {
    try {
      require('fs').rmSync(dataFilePath, { force: true });
    } catch {
      // ignore cleanup failures
    }
    server.kill();
    await delay(200);
    if (server.exitCode && server.exitCode !== 0 && stderr.trim()) {
      console.error(stderr.trim());
    }
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
