import type React from 'react';
import type { FilterKey, SortKey } from '../types';

type FilterCounts = {
  needs_action: number;
  in_progress: number;
  submitted: number;
  offline: number;
  refills: number;
  all: number;
};

type AdminToolbarProps = {
  q: string;
  onlyMain: boolean;
  onlyOnline: boolean;
  onlyCurrent: boolean;
  sortBy: SortKey;
  pageSize: number;
  filter: FilterKey;
  filterCounts: FilterCounts;
  totalRows: number;
  pageStart: number;
  safePage: number;
  totalPages: number;
  pendingCount: number;
  hasPending: boolean;
  searchRef: React.RefObject<HTMLInputElement>;
  onSetQ: (value: string) => void;
  onSetOnlyMain: (value: boolean) => void;
  onSetOnlyOnline: (value: boolean) => void;
  onSetOnlyCurrent: (value: boolean) => void;
  onSetSortBy: (value: SortKey) => void;
  onSetPageSize: (value: number) => void;
  onSetExpandAll: (value: boolean) => void;
  onSetFilter: (value: FilterKey) => void;
  onSetPage: (next: number | ((prev: number) => number)) => void;
  onApplyPending: () => void;
};

function FilterButton({
  current,
  target,
  label,
  count,
  onClick,
}: {
  current: FilterKey;
  target: FilterKey;
  label: string;
  count: number;
  onClick: (next: FilterKey) => void;
}) {
  return (
    <button
      onClick={() => onClick(target)}
      className={[
        'px-2.5 py-1.5 rounded-lg text-xs border transition-all',
        current === target
          ? 'bg-[#58a6ff]/15 text-[#79c0ff] border-[#58a6ff]/30'
          : 'bg-[#21262d] text-[#8b949e] border-[#30363d] hover:bg-[#2b313a]',
      ].join(' ')}
    >
      {label}
      <span className="ml-1.5 font-mono text-[11px] opacity-80">{count}</span>
    </button>
  );
}

export function AdminToolbar({
  q,
  onlyMain,
  onlyOnline,
  onlyCurrent,
  sortBy,
  pageSize,
  filter,
  filterCounts,
  totalRows,
  pageStart,
  safePage,
  totalPages,
  pendingCount,
  hasPending,
  searchRef,
  onSetQ,
  onSetOnlyMain,
  onSetOnlyOnline,
  onSetOnlyCurrent,
  onSetSortBy,
  onSetPageSize,
  onSetExpandAll,
  onSetFilter,
  onSetPage,
  onApplyPending,
}: AdminToolbarProps) {
  return (
    <div className="mb-4 bg-[#161b22] border border-[#30363d] rounded-2xl p-3 shadow-2xl">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <div className="relative flex-1">
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => onSetQ(e.target.value)}
              placeholder="搜索：序号 / 姓名 / IP / 地址 / 邮箱 / 电话 / 状态"
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-xs outline-none focus:border-[#58a6ff]"
            />
            {q && (
              <button
                onClick={() => onSetQ('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-[#c9d1d9]"
                title="清空搜索"
              >
                x
              </button>
            )}
          </div>

          <label className="flex items-center gap-1.5 text-xs text-[#8b949e]">
            <input type="checkbox" checked={onlyMain} onChange={(e) => onSetOnlyMain(e.target.checked)} className="accent-[#58a6ff]" />
            仅主记录
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#8b949e]">
            <input type="checkbox" checked={onlyOnline} onChange={(e) => onSetOnlyOnline(e.target.checked)} className="accent-[#58a6ff]" />
            仅在线
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#8b949e]">
            <input type="checkbox" checked={onlyCurrent} onChange={(e) => onSetOnlyCurrent(e.target.checked)} className="accent-[#58a6ff]" />
            仅当前活跃
          </label>

          <select
            value={sortBy}
            onChange={(e) => onSetSortBy(e.target.value as SortKey)}
            className="bg-[#0d1117] border border-[#30363d] rounded-lg px-2 py-1.5 text-[11px] outline-none"
          >
            <option value="recent_activity">按最近活跃</option>
            <option value="id_desc">按序号倒序</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => onSetPageSize(Number(e.target.value))}
            className="bg-[#0d1117] border border-[#30363d] rounded-lg px-2 py-1.5 text-[11px] outline-none"
          >
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>

          <button
            onClick={() => onSetExpandAll(true)}
            className="bg-[#21262d] hover:bg-[#2b313a] border border-[#30363d] px-2.5 py-1.5 rounded-lg text-[11px]"
          >
            全部展开
          </button>
          <button
            onClick={() => onSetExpandAll(false)}
            className="bg-[#21262d] hover:bg-[#2b313a] border border-[#30363d] px-2.5 py-1.5 rounded-lg text-[11px]"
          >
            全部折叠
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <FilterButton current={filter} target="needs_action" label="需处理" count={filterCounts.needs_action} onClick={onSetFilter} />
          <FilterButton current={filter} target="in_progress" label="填写中" count={filterCounts.in_progress} onClick={onSetFilter} />
          <FilterButton current={filter} target="submitted" label="已提交" count={filterCounts.submitted} onClick={onSetFilter} />
          <FilterButton current={filter} target="refills" label="有重填" count={filterCounts.refills} onClick={onSetFilter} />
          <FilterButton current={filter} target="offline" label="离线" count={filterCounts.offline} onClick={onSetFilter} />
          <FilterButton current={filter} target="all" label="全部" count={filterCounts.all} onClick={onSetFilter} />
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2">
          <div className="text-[11px] text-[#8b949e]">
            当前显示 <span className="font-mono text-[#c9d1d9]">{totalRows === 0 ? 0 : pageStart + 1}</span> -{' '}
            <span className="font-mono text-[#c9d1d9]">{Math.min(pageStart + pageSize, totalRows)}</span> /{' '}
            <span className="font-mono text-[#c9d1d9]">{totalRows}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => onSetPage(1)} disabled={safePage <= 1} className="bg-[#21262d] border border-[#30363d] px-2 py-1 rounded text-[11px] disabled:opacity-40">
              首页
            </button>
            <button
              onClick={() => onSetPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="bg-[#21262d] border border-[#30363d] px-2 py-1 rounded text-[11px] disabled:opacity-40"
            >
              上一页
            </button>
            <span className="text-[11px] text-[#8b949e]">
              第 <span className="font-mono text-[#c9d1d9]">{safePage}</span> / <span className="font-mono text-[#c9d1d9]">{totalPages}</span> 页
            </span>
            <button
              onClick={() => onSetPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="bg-[#21262d] border border-[#30363d] px-2 py-1 rounded text-[11px] disabled:opacity-40"
            >
              下一页
            </button>
            <button onClick={() => onSetPage(totalPages)} disabled={safePage >= totalPages} className="bg-[#21262d] border border-[#30363d] px-2 py-1 rounded text-[11px] disabled:opacity-40">
              末页
            </button>
          </div>
        </div>

        {hasPending && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#58a6ff]/35 bg-[#58a6ff]/10 px-3 py-2">
            <div className="text-xs text-[#c9d1d9]">
              检测到新更新{pendingCount > 0 ? `（约 ${pendingCount} 条新增）` : ''}，已暂停自动刷新以避免页面跳动。
            </div>
            <button
              onClick={onApplyPending}
              className="bg-[#58a6ff]/25 hover:bg-[#58a6ff]/35 border border-[#58a6ff]/45 text-[#c9e4ff] px-2.5 py-1 rounded-lg text-xs"
            >
              立即刷新视图
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
