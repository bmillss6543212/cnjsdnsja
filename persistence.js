const fs = require('fs');
const path = require('path');

function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return null;
  return JSON.parse(raw);
}

function appendArchiveRecords(archiveFilePath, records) {
  if (!archiveFilePath || !Array.isArray(records) || records.length === 0) return;
  ensureDirForFile(archiveFilePath);
  const lines = records.map((record) => JSON.stringify(record)).join('\n') + '\n';
  fs.appendFileSync(archiveFilePath, lines, 'utf8');
}

function createPersistence({ filePath, archiveFilePath, saveDelayMs = 300, serialize, transformBeforeSave }) {
  let timer = null;
  let pendingWrite = null;

  function writeNow() {
    const baseState = serialize();
    const transformed = transformBeforeSave ? transformBeforeSave(baseState) : { state: baseState, archivedRecords: [] };
    const payload = JSON.stringify(transformed.state, null, 2);
    ensureDirForFile(filePath);
    fs.writeFileSync(filePath, payload, 'utf8');
    appendArchiveRecords(archiveFilePath, transformed.archivedRecords);
  }

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    writeNow();
    pendingWrite = null;
  }

  function scheduleSave() {
    if (timer) clearTimeout(timer);
    pendingWrite = true;
    timer = setTimeout(() => {
      timer = null;
      try {
        writeNow();
        pendingWrite = null;
      } catch (error) {
        console.error('[persistence] save failed:', error && error.message ? error.message : error);
      }
    }, saveDelayMs);
  }

  return {
    filePath,
    archiveFilePath,
    load: () => readJsonFile(filePath),
    scheduleSave,
    flush,
    hasPendingWrite: () => !!pendingWrite,
  };
}

module.exports = {
  createPersistence,
};
