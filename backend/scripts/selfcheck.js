const path = require('path');

function runCheck(label, fn) {
  try {
    fn();
    console.log(`ok ${label}`);
  } catch (error) {
    console.error(`fail ${label}: ${error && error.message ? error.message : error}`);
    process.exitCode = 1;
  }
}

runCheck('config module loads', () => {
  const { buildConfig } = require(path.join('..', 'config'));
  process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'selfcheck-password';
  const config = buildConfig(path.join(__dirname, '..'));
  if (!config.adminStaticDir) throw new Error('missing adminStaticDir');
  if (!config.corsOptions) throw new Error('missing corsOptions');
});

runCheck('record store basic flow', () => {
  const { createRecordStore } = require(path.join('..', 'record-store'));
  const store = createRecordStore();
  const onlineUsers = new Map();

  onlineUsers.set('socket-1', { activeRecordId: null });
  store.appendRecord({ id: 1, clientId: 'client-1', socketId: 'socket-1', createdAt: 1, updatedAt: 1, active: true });
  store.appendRecord({ id: '1.1', clientId: 'client-1', socketId: 'socket-1', createdAt: 2, updatedAt: 2, active: false });

  if (!store.getMainRecord('socket-1')) throw new Error('main record lookup failed');
  if (store.getClientRecords('client-1').length !== 2) throw new Error('client records lookup failed');

  store.setActiveRecord('socket-1', '1.1', onlineUsers);
  const active = store.getActiveRecord('socket-1', onlineUsers);
  if (!active || active.id !== '1.1') throw new Error('active record lookup failed');
  if (store.nextSubId(1) !== '1.2') throw new Error('nextSubId failed');
});

runCheck('discord notifier factory loads', () => {
  const { createDiscordNotifier } = require(path.join('..', 'discord'));
  const notify = createDiscordNotifier({
    discordWebhookUrl: '',
    discordWebhookDebug: false,
    discordProxyUrl: '',
  });
  notify({ clientId: 'noop' });
});

runCheck('persistence roundtrip', () => {
  const fs = require('fs');
  const os = require('os');
  const { createPersistence } = require(path.join('..', 'persistence'));
  const tempFile = path.join(os.tmpdir(), `crm-backend-selfcheck-${process.pid}.json`);
  const payload = { recordCounter: 3, records: [{ id: 1 }] };
  const persistence = createPersistence({
    filePath: tempFile,
    serialize: () => payload,
  });

  persistence.flush();
  const loaded = persistence.load();
  if (!loaded || loaded.recordCounter !== 3 || !Array.isArray(loaded.records) || loaded.records.length !== 1) {
    throw new Error('persistence roundtrip failed');
  }
  fs.rmSync(tempFile, { force: true });
});

runCheck('config disables persistence by default', () => {
  const { buildConfig } = require(path.join('..', 'config'));
  const prevDataFile = process.env.DATA_FILE;
  process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'selfcheck-password';
  delete process.env.DATA_FILE;
  const config = buildConfig(path.join(__dirname, '..'));
  if (config.dataFilePath !== '') {
    throw new Error('DATA_FILE should default to disabled persistence');
  }
  if (prevDataFile !== undefined) {
    process.env.DATA_FILE = prevDataFile;
  }
});

runCheck('retention policy archives stale offline records', () => {
  const { createRetentionPolicy } = require(path.join('..', 'data-retention'));
  const now = Date.now();
  const applyRetention = createRetentionPolicy({ maxActiveRecords: 2, retentionDays: 30 });
  const result = applyRetention({
    recordCounter: 4,
    records: [
      { id: 1, online: false, updatedAt: now - 40 * 24 * 60 * 60 * 1000 },
      { id: 2, online: false, updatedAt: now - 10 * 24 * 60 * 60 * 1000 },
      { id: 3, online: true, updatedAt: now - 50 * 24 * 60 * 60 * 1000 },
    ],
  });

  if (!Array.isArray(result.archivedRecords) || result.archivedRecords.length !== 1) {
    throw new Error('retention policy did not archive expected stale record');
  }
  if (!Array.isArray(result.state.records) || result.state.records.length !== 2) {
    throw new Error('retention policy did not keep expected active records');
  }
});

if (!process.exitCode) {
  console.log('selfcheck passed');
}
