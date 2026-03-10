function createRecordStore() {
  let records = [];
  let recordCounter = 1;
  const recordsById = new Map();
  const recordsByClientId = new Map();
  const recordsBySocketId = new Map();
  const subRecordCounterByMainId = new Map();

  const isSubId = (id) => id.toString().includes('.');
  const getMainId = (recordId) => {
    const n = parseInt((recordId || '').toString().split('.')[0], 10);
    return Number.isFinite(n) ? n : null;
  };

  function addToBucket(indexMap, key, record) {
    if (!key) return;
    let bucket = indexMap.get(key);
    if (!bucket) {
      bucket = new Set();
      indexMap.set(key, bucket);
    }
    bucket.add(record);
  }

  function removeFromBucket(indexMap, key, record) {
    if (!key) return;
    const bucket = indexMap.get(key);
    if (!bucket) return;
    bucket.delete(record);
    if (bucket.size === 0) indexMap.delete(key);
  }

  function indexRecord(record) {
    recordsById.set(record.id, record);
    addToBucket(recordsByClientId, record.clientId, record);
    addToBucket(recordsBySocketId, record.socketId, record);

    if (isSubId(record.id)) {
      const mainId = getMainId(record.id);
      const subSeq = parseInt(record.id.toString().split('.')[1] || '0', 10);
      if (mainId && Number.isFinite(subSeq)) {
        subRecordCounterByMainId.set(mainId, Math.max(subRecordCounterByMainId.get(mainId) || 0, subSeq));
      }
    }
  }

  function appendRecord(record) {
    records.push(record);
    indexRecord(record);
  }

  function rebuildIndexes() {
    recordsById.clear();
    recordsByClientId.clear();
    recordsBySocketId.clear();
    subRecordCounterByMainId.clear();
    records.forEach(indexRecord);
  }

  function reindexRecordLinks(record, prevClientId, prevSocketId) {
    if (prevClientId !== record.clientId) {
      removeFromBucket(recordsByClientId, prevClientId, record);
      addToBucket(recordsByClientId, record.clientId, record);
    }
    if (prevSocketId !== record.socketId) {
      removeFromBucket(recordsBySocketId, prevSocketId, record);
      addToBucket(recordsBySocketId, record.socketId, record);
    }
  }

  function updateRecordOwnership(record, nextValues) {
    if (!record) return;
    const prevClientId = record.clientId;
    const prevSocketId = record.socketId;
    Object.assign(record, nextValues);
    reindexRecordLinks(record, prevClientId, prevSocketId);
  }

  return {
    isSubId,
    getMainId,
    get records() {
      return records;
    },
    set records(nextRecords) {
      records = nextRecords;
      rebuildIndexes();
    },
    get recordCounter() {
      return recordCounter;
    },
    set recordCounter(value) {
      recordCounter = value;
    },
    recordsById,
    recordsByClientId,
    recordsBySocketId,
    subRecordCounterByMainId,
    appendRecord,
    updateRecordOwnership,
    getMainRecord(socketId) {
      const socketRecords = recordsBySocketId.get(socketId);
      if (!socketRecords) return null;
      for (const record of socketRecords) {
        if (!isSubId(record.id)) return record;
      }
      return null;
    },
    getMainRecordByClientId(clientId) {
      if (!clientId) return null;
      const clientRecords = Array.from(recordsByClientId.get(clientId) || []);
      const mains = clientRecords.filter((r) => !isSubId(r.id)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return mains[0] || null;
    },
    getClientRecords(clientId) {
      if (!clientId) return [];
      return Array.from(recordsByClientId.get(clientId) || []);
    },
    getActiveRecord(socketId, onlineUsers) {
      const user = onlineUsers.get(socketId);
      if (!user?.activeRecordId) return null;
      const activeRecord = recordsById.get(user.activeRecordId) || null;
      if (activeRecord && activeRecord.socketId === socketId) return activeRecord;
      return null;
    },
    setActiveRecord(socketId, recordId, onlineUsers) {
      const user = onlineUsers.get(socketId);
      if (user) user.activeRecordId = recordId;

      for (const r of recordsBySocketId.get(socketId) || []) {
        if (r.socketId === socketId) r.active = r.id === recordId;
      }
    },
    nextSubId(mainId) {
      const maxN = subRecordCounterByMainId.get(mainId) || 0;
      subRecordCounterByMainId.set(mainId, maxN + 1);
      return `${mainId}.${maxN + 1}`;
    },
    getLatestRecordForSocket(socketId) {
      const socketRecords = Array.from(recordsBySocketId.get(socketId) || []);
      return socketRecords.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
    },
    clear() {
      records = [];
      recordCounter = 1;
      recordsById.clear();
      recordsByClientId.clear();
      recordsBySocketId.clear();
      subRecordCounterByMainId.clear();
    },
    hydrate(state) {
      records = Array.isArray(state?.records) ? state.records : [];
      recordCounter = Number.isFinite(Number(state?.recordCounter)) ? Number(state.recordCounter) : 1;
      rebuildIndexes();
      const maxMainId = records
        .map((record) => getMainId(record.id))
        .filter((value) => Number.isFinite(value))
        .reduce((max, value) => Math.max(max, value), 0);
      if (recordCounter <= maxMainId) {
        recordCounter = maxMainId + 1;
      }
    },
  };
}

module.exports = {
  createRecordStore,
};
