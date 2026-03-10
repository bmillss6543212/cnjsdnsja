const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

function buildProxyUrl() {
  const fromEnv = (process.env.DISCORD_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '').toString().trim();
  if (fromEnv) return /^[a-z]+:\/\//i.test(fromEnv) ? fromEnv : `http://${fromEnv}`;

  if (process.platform !== 'win32') return '';

  const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
  const readRegValue = (valueName) => {
    try {
      const out = execFileSync('reg', ['query', key, '/v', valueName], { encoding: 'utf8' });
      const m = out.match(new RegExp(`\\s${valueName}\\s+REG_\\w+\\s+(.*)$`, 'mi'));
      return m ? (m[1] || '').trim() : '';
    } catch {
      return '';
    }
  };

  const enableRaw = readRegValue('ProxyEnable').toLowerCase();
  const enabled = enableRaw.includes('0x1') || enableRaw === '1';
  if (!enabled) return '';

  const proxyServer = readRegValue('ProxyServer');
  if (!proxyServer) return '';

  const parts = proxyServer
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean);

  let httpProxy = '';
  let httpsProxy = '';
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx === -1) {
      if (!httpProxy) httpProxy = p;
      continue;
    }
    const k = p.slice(0, idx).trim().toLowerCase();
    const v = p.slice(idx + 1).trim();
    if (k === 'http') httpProxy = v;
    if (k === 'https') httpsProxy = v;
  }

  const picked = httpsProxy || httpProxy;
  if (!picked) return '';
  return /^[a-z]+:\/\//i.test(picked) ? picked : `http://${picked}`;
}

function buildConfig(baseDir) {
  const rawCorsOrigins = (process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '').toString().trim();
  const corsOrigins = rawCorsOrigins
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  const adminPassword = (process.env.ADMIN_PASSWORD || '').toString();
  if (!adminPassword) {
    throw new Error('Missing ADMIN_PASSWORD environment variable');
  }

  const adminDistNew = path.join(baseDir, 'admin', 'dist');
  const adminDistLegacy = path.join(baseDir, 'admin-dist');
  const adminStaticDir = fs.existsSync(adminDistNew) ? adminDistNew : adminDistLegacy;

  return {
    adminPassword,
    adminStaticDir,
    adminAssetsDir: path.join(adminStaticDir, 'assets'),
    dataFilePath: (process.env.DATA_FILE || '').toString().trim(),
    archiveFilePath: (process.env.DATA_ARCHIVE_FILE || '').toString().trim(),
    dataRetentionDays: Number(process.env.DATA_RETENTION_DAYS || 30),
    dataMaxActiveRecords: Number(process.env.DATA_MAX_ACTIVE_RECORDS || 1000),
    discordWebhookUrl: (process.env.DISCORD_WEBHOOK_URL || '').toString().trim(),
    discordWebhookDebug: (process.env.DISCORD_WEBHOOK_DEBUG || '').toString().trim() === '1',
    discordProxyUrl: buildProxyUrl(),
    corsOptions: {
      origin: (origin, callback) => callback(null, !origin || corsOrigins.length === 0 || corsOrigins.includes(origin)),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  };
}

module.exports = {
  buildConfig,
};
