const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const serverEntry = path.join(projectRoot, 'server.js');
const dataFilePath = path.join(projectRoot, 'tmp', `archive-${process.pid}.json`);
const archiveFilePath = path.join(projectRoot, 'tmp', `archive-${process.pid}.ndjson`);

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

async function main() {
  const staleRecord = {
    id: 1,
    clientId: 'archived-client',
    socketId: 'offline-socket',
    online: false,
    page: 'left',
    status: 'Offline',
    history: [],
    checkoutSnapshots: [],
    verifyHistory: [],
    createdAt: Date.now() - 50 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
  };

  fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
  fs.writeFileSync(
    dataFilePath,
    JSON.stringify(
      {
        recordCounter: 2,
        records: [staleRecord],
      },
      null,
      2
    ),
    'utf8'
  );

  const server = spawn(process.execPath, [serverEntry], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: '3911',
      ADMIN_PASSWORD: 'archive-test-password',
      DISCORD_WEBHOOK_URL: '',
      DATA_FILE: dataFilePath,
      DATA_ARCHIVE_FILE: archiveFilePath,
      DATA_RETENTION_DAYS: '30',
      DATA_MAX_ACTIVE_RECORDS: '100',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  server.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForServer('http://127.0.0.1:3911/');
    await delay(1200);

    const activeState = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    if (!Array.isArray(activeState.records) || activeState.records.length !== 0) {
      throw new Error('stale record was not pruned from active data file');
    }

    if (!fs.existsSync(archiveFilePath)) {
      throw new Error('archive file was not created');
    }

    const archivedLines = fs
      .readFileSync(archiveFilePath, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    if (!archivedLines.find((record) => String(record.id) === '1')) {
      throw new Error('stale record was not written to archive');
    }

    console.log('archive-test passed');
  } finally {
    server.kill();
    await delay(300);
    try {
      fs.rmSync(dataFilePath, { force: true });
      fs.rmSync(archiveFilePath, { force: true });
    } catch {
      // ignore cleanup failures
    }
    if (server.exitCode && server.exitCode !== 0 && stderr.trim()) {
      throw new Error(stderr.trim());
    }
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
