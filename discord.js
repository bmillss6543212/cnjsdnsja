const https = require('https');
const net = require('net');
const tls = require('tls');

function postJson(urlString, payload, { timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(urlString);
      const body = JSON.stringify(payload || {});

      const req = https.request(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port || (u.protocol === 'https:' ? 443 : 80),
          path: u.pathname + u.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          res.resume();
          if (!ok) reject(new Error(`http ${res.statusCode || 0}`));
          else resolve(true);
        }
      );

      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('timeout'));
      });

      req.write(body);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

function postJsonViaHttpProxy(proxyUrlString, targetUrlString, payload, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const proxyUrl = new URL(proxyUrlString);
      const targetUrl = new URL(targetUrlString);
      const targetHost = targetUrl.hostname;
      const targetPort = Number(targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80));
      const body = JSON.stringify(payload || {});

      const proxyPort = Number(proxyUrl.port || 80);
      const proxyHost = proxyUrl.hostname;
      const proxyAuth =
        proxyUrl.username || proxyUrl.password
          ? Buffer.from(`${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`).toString('base64')
          : '';

      const sock = net.createConnection({ host: proxyHost, port: proxyPort });
      let settled = false;
      const done = (err) => {
        if (settled) return;
        settled = true;
        try {
          sock.destroy();
        } catch {
          // ignore
        }
        if (err) reject(err);
        else resolve(true);
      };

      sock.setTimeout(timeoutMs, () => done(new Error('proxy timeout')));
      sock.on('error', (e) => done(e));

      sock.on('connect', () => {
        const headers = [
          `CONNECT ${targetHost}:${targetPort} HTTP/1.1`,
          `Host: ${targetHost}:${targetPort}`,
          'Proxy-Connection: keep-alive',
          proxyAuth ? `Proxy-Authorization: Basic ${proxyAuth}` : null,
          '',
          '',
        ]
          .filter(Boolean)
          .join('\r\n');
        sock.write(headers);
      });

      let buf = '';
      const onProxyData = (chunk) => {
        buf += chunk.toString('utf8');
        const idx = buf.indexOf('\r\n\r\n');
        if (idx === -1) return;

        sock.off('data', onProxyData);
        const head = buf.slice(0, idx);
        const firstLine = head.split('\r\n')[0] || '';
        const m = firstLine.match(/HTTP\/\d\.\d\s+(\d+)/i);
        const code = m ? parseInt(m[1], 10) : 0;
        if (code !== 200) {
          done(new Error(`proxy connect failed: ${firstLine}`));
          return;
        }

        const tlsSock = tls.connect({
          socket: sock,
          servername: targetHost,
        });

        tlsSock.setTimeout(timeoutMs, () => {
          try {
            tlsSock.destroy(new Error('tls timeout'));
          } catch {
            // ignore
          }
        });

        tlsSock.on('error', (e) => done(e));

        let resp = '';
        let statusCode = 0;
        tlsSock.on('data', (d) => {
          resp += d.toString('utf8');
          if (!statusCode) {
            const lineEnd = resp.indexOf('\r\n');
            if (lineEnd !== -1) {
              const line = resp.slice(0, lineEnd);
              const mm = line.match(/HTTP\/\d\.\d\s+(\d+)/i);
              statusCode = mm ? parseInt(mm[1], 10) : 0;
            }
          }
        });

        tlsSock.on('end', () => {
          if (statusCode >= 200 && statusCode < 300) done(null);
          else done(new Error(`webhook http ${statusCode || 0}`));
        });

        const path = `${targetUrl.pathname}${targetUrl.search}`;
        const reqLines = [
          `POST ${path} HTTP/1.1`,
          `Host: ${targetHost}`,
          'User-Agent: crm-project',
          'Content-Type: application/json',
          `Content-Length: ${Buffer.byteLength(body)}`,
          'Connection: close',
          '',
          '',
        ].join('\r\n');

        tlsSock.write(reqLines);
        tlsSock.write(body);
      };

      sock.on('data', onProxyData);
    } catch (e) {
      reject(e);
    }
  });
}

function createDiscordNotifier({ discordWebhookUrl, discordWebhookDebug, discordProxyUrl }) {
  return function notifyDiscordHomeOnline({ time, ip, deviceType, deviceOS, recordId, clientId } = {}) {
    if (!discordWebhookUrl) return;

    const lines = [
      'User online (Home)',
      time ? `Time: ${time}` : null,
      ip ? `IP: ${ip}` : null,
      deviceType || deviceOS ? `Device: ${[deviceType, deviceOS].filter(Boolean).join(' / ')}` : null,
      recordId ? `Record: ${recordId}` : null,
      clientId ? `Client: ${clientId}` : null,
    ].filter(Boolean);

    const content = lines.join('\n').slice(0, 1900);
    const send = discordProxyUrl
      ? postJsonViaHttpProxy(discordProxyUrl, discordWebhookUrl, { content }, { timeoutMs: 12_000 })
      : postJson(discordWebhookUrl, { content }, { timeoutMs: 12_000 });

    send
      .then(() => {
        if (discordWebhookDebug) console.log('[discord] webhook ok', discordProxyUrl ? '(proxy)' : '(direct)');
      })
      .catch((e) => {
        if (discordWebhookDebug) console.log('[discord] webhook failed:', e?.message || e);
      });
  };
}

module.exports = {
  createDiscordNotifier,
};
