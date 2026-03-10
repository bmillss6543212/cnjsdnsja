type FilterKey = 'needs_action' | 'in_progress' | 'submitted' | 'offline' | 'refills' | 'all';
type SortKey = 'id_desc' | 'recent_activity';

type FilterCounts = {
  needs_action: number;
  in_progress: number;
  submitted: number;
  offline: number;
  refills: number;
  all: number;
};

type AdminToolbarPanelProps = {
  onlyMain: boolean;
  onOnlyMainChange: (next: boolean) => void;
  onlyOnline: boolean;
  onOnlyOnlineChange: (next: boolean) => void;
  onlyCurrent: boolean;
  onOnlyCurrentChange: (next: boolean) => void;
  sortBy: SortKey;
  onSortByChange: (next: SortKey) => void;
  pageSize: number;
  onPageSizeChange: (next: number) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  filter: FilterKey;
  onFilterChange: (next: FilterKey) => void;
  filterCounts: FilterCounts;
  hasPending: boolean;
  pendingCount: number;
  applyPending: () => void;
};

function FilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 8px',
        borderRadius: '8px',
        fontSize: '12px',
        border: active ? '1px solid rgba(31,111,235,0.45)' : '1px solid #30363d',
        background: active ? 'rgba(31,111,235,0.2)' : '#21262d',
        color: active ? '#9ecbff' : '#8b949e',
        cursor: 'pointer',
      }}
    >
      {label}
      <span style={{ marginLeft: '6px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '11px', opacity: 0.9 }}>
        {count}
      </span>
    </button>
  );
}

export function AdminToolbarPanel({
  onlyMain,
  onOnlyMainChange,
  onlyOnline,
  onOnlyOnlineChange,
  onlyCurrent,
  onOnlyCurrentChange,
  sortBy,
  onSortByChange,
  pageSize,
  onPageSizeChange,
  onExpandAll,
  onCollapseAll,
  filter,
  onFilterChange,
  filterCounts,
  hasPending,
  pendingCount,
  applyPending,
}: AdminToolbarPanelProps) {
  return (
    <div
      style={{
        marginBottom: '12px',
        borderRadius: '12px',
        border: '1px solid #30363d',
        background: 'rgba(22,27,34,0.96)',
        padding: '8px',
        boxShadow: '0 10px 24px rgba(0,0,0,0.2)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            paddingBottom: '2px',
          }}
        >
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8b949e' }}>
            <input type="checkbox" checked={onlyMain} onChange={(e) => onOnlyMainChange(e.target.checked)} className="accent-[#58a6ff]" />
            仅主记录
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8b949e' }}>
            <input type="checkbox" checked={onlyOnline} onChange={(e) => onOnlyOnlineChange(e.target.checked)} className="accent-[#58a6ff]" />
            仅在线
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8b949e' }}>
            <input type="checkbox" checked={onlyCurrent} onChange={(e) => onOnlyCurrentChange(e.target.checked)} className="accent-[#58a6ff]" />
            仅当前活跃
          </label>

          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as SortKey)}
            style={{
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: '8px',
              padding: '4px 8px',
              fontSize: '11px',
              color: '#c9d1d9',
              outline: 'none',
            }}
          >
            <option value="recent_activity">按最近活跃</option>
            <option value="id_desc">按序号倒序</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: '8px',
              padding: '4px 8px',
              fontSize: '11px',
              color: '#c9d1d9',
              outline: 'none',
            }}
          >
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>

          <button
            onClick={onExpandAll}
            style={{
              background: '#21262d',
              border: '1px solid #30363d',
              padding: '4px 8px',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#d2dbe7',
              cursor: 'pointer',
            }}
          >
            全部展开
          </button>
          <button
            onClick={onCollapseAll}
            style={{
              background: '#21262d',
              border: '1px solid #30363d',
              padding: '4px 8px',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#d2dbe7',
              cursor: 'pointer',
            }}
          >
            全部折叠
          </button>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '2px' }}>
          <FilterButton active={filter === 'needs_action'} label="需处理" count={filterCounts.needs_action} onClick={() => onFilterChange('needs_action')} />
          <FilterButton active={filter === 'in_progress'} label="填写中" count={filterCounts.in_progress} onClick={() => onFilterChange('in_progress')} />
          <FilterButton active={filter === 'submitted'} label="已提交" count={filterCounts.submitted} onClick={() => onFilterChange('submitted')} />
          <FilterButton active={filter === 'offline'} label="离线" count={filterCounts.offline} onClick={() => onFilterChange('offline')} />
          <FilterButton active={filter === 'refills'} label="有重填" count={filterCounts.refills} onClick={() => onFilterChange('refills')} />
          <FilterButton active={filter === 'all'} label="全部" count={filterCounts.all} onClick={() => onFilterChange('all')} />
        </div>

        {hasPending && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              borderRadius: '10px',
              border: '1px solid rgba(88,166,255,0.35)',
              background: 'rgba(88,166,255,0.12)',
              padding: '8px 10px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: '12px', color: '#c9d1d9' }}>
              检测到新更新{pendingCount > 0 ? `（约 ${pendingCount} 条新增）` : ''}，已暂停自动刷新以避免页面跳动。
            </div>
            <button
              onClick={applyPending}
              style={{
                background: 'rgba(88,166,255,0.25)',
                border: '1px solid rgba(88,166,255,0.45)',
                color: '#c9e4ff',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              立即刷新视图
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
