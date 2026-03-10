const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const serverEntry = path.join(projectRoot, 'server.js');
const socketClientEntry = path.join(projectRoot, 'admin', 'node_modules', 'socket.io-client', 'build', 'cjs', 'index.js');
const dataFilePath = path.join(projectRoot, 'tmp', `persistence-${process.pid}.json`);
const adminPassword = process.env.ADMIN_PASSWORD || 'persistence-test-password';

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
      // ignore
    }
    await delay(200);
  }
  throw new Error(`server did not become ready within ${timeoutMs}ms`);
}

async function connectSocket(io, url) {
  const socket = io(url, {
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

  return socket;
}

function emitAck(socket, eventName, payload, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting ack for ${eventName}`)), timeoutMs);
    socket.emit(eventName, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

async function runServer(port, action) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [serverEntry], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      ADMIN_PASSWORD: adminPassword,
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
    await action(baseUrl);
  } finally {
    server.kill();
    await delay(300);
    if (server.exitCode && server.exitCode !== 0 && stderr.trim()) {
      throw new Error(stderr.trim());
    }
  }
}

async function main() {
  if (!fs.existsSync(socketClientEntry)) {
    throw new Error(`socket.io-client not found at ${socketClientEntry}`);
  }

  const { io } = require(socketClientEntry);

  try {
    await runServer(3811, async (baseUrl) => {
      const userSocket = await connectSocket(io, baseUrl);
      await emitAck(userSocket, 'attach-client', { clientId: 'persist-client' });
      const registerResult = await emitAck(userSocket, 'register-user', { clientId: 'persist-client' });
      if (!registerResult || registerResult.ok !== true || registerResult.recordId !== 1) {
        throw new Error(`unexpected register-user result: ${JSON.stringify(registerResult)}`);
      }
      userSocket.disconnect();
      await delay(1000);
      if (!fs.existsSync(dataFilePath)) {
        throw new Error('data file not created');
      }
      const saved = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
      if (!Array.isArray(saved.records) || saved.records.length !== 1) {
        throw new Error('persisted records missing');
      }
    });

    await runServer(3812, async (baseUrl) => {
      const adminSocket = await connectSocket(io, baseUrl);
      const adminUpdatePromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('admin-update timeout')), 5000);
        adminSocket.once('admin-update', (payload) => {
          clearTimeout(timer);
          resolve(payload);
        });
      });

      const joinAdminResult = await emitAck(adminSocket, 'join-admin', { password: adminPassword });
      if (!joinAdminResult || joinAdminResult.ok !== true) {
        throw new Error(`join-admin failed: ${JSON.stringify(joinAdminResult)}`);
      }

      const update = await adminUpdatePromise;
      if (!Array.isArray(update.records) || !update.records.find((record) => String(record.id) === '1')) {
        throw new Error('persisted record not restored');
      }
      adminSocket.disconnect();
    });

    console.log('persistence-test passed');
  } finally {
    try {
      fs.rmSync(dataFilePath, { force: true });
    } catch {
      // ignore cleanup failures
    }
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
