function createRetentionPolicy({ maxActiveRecords = 1000, retentionDays = 30 } = {}) {
  const retentionMs = Math.max(0, Number(retentionDays) || 0) * 24 * 60 * 60 * 1000;
  const normalizedMaxActiveRecords = Math.max(1, Number(maxActiveRecords) || 1000);

  return function applyRetention(state) {
    const records = Array.isArray(state?.records) ? [...state.records] : [];
    if (records.length <= normalizedMaxActiveRecords && retentionMs === 0) {
      return { state, archivedRecords: [] };
    }

    const now = Date.now();
    const activeRecords = [];
    const staleOfflineRecords = [];

    records
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
      .forEach((record) => {
        const updatedAt = Number(record?.updatedAt || record?.createdAt || 0);
        const expiredByAge = retentionMs > 0 && updatedAt > 0 && now - updatedAt > retentionMs;
        if (record?.online === true || !expiredByAge) {
          activeRecords.push(record);
        } else {
          staleOfflineRecords.push(record);
        }
      });

    const keptRecords = activeRecords.slice(0, normalizedMaxActiveRecords);
    const overflowRecords = activeRecords.slice(normalizedMaxActiveRecords).filter((record) => record?.online !== true);
    const archivedRecords = [...staleOfflineRecords, ...overflowRecords];

    return {
      state: {
        ...state,
        records: keptRecords,
      },
      archivedRecords,
    };
  };
}

module.exports = {
  createRetentionPolicy,
};
