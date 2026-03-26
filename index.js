const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const port = process.env.PORT || 3000;

function send(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers });
  res.end(body);
}

function handleRequest(req, res) {
  const u = new URL(req.url, `http://localhost:${port}`);
  if (req.method === 'GET' && u.pathname === '/') {
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Internal Server Error');
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }
  if (req.method === 'GET' && u.pathname === '/request') {
    const target = u.searchParams.get('url');
    if (!target) return send(res, 400, { error: 'missing url' });
    let parsed;
    try {
      parsed = new URL(target);
    } catch (e) {
      return send(res, 400, { error: 'invalid url' });
    }
    const client = parsed.protocol === 'http:' ? http : https;
    const reqOptions = { method: 'GET', headers: { 'Accept': '*/*', 'Accept-Encoding': 'gzip, deflate, br' } };
    const out = client.request(parsed, reqOptions, (resp) => {
      const chunks = [];
      resp.on('data', (c) => chunks.push(c));
      resp.on('end', () => {
        const buf = Buffer.concat(chunks);
        const enc = String(resp.headers['content-encoding'] || '').toLowerCase();
        let rawBuf = buf;
        try {
          if (enc.includes('br')) rawBuf = zlib.brotliDecompressSync(buf);
          else if (enc.includes('gzip')) rawBuf = zlib.gunzipSync(buf);
          else if (enc.includes('deflate')) rawBuf = zlib.inflateSync(buf);
        } catch (_) {}
        const ct = String(resp.headers['content-type'] || '');
        let charset = 'utf-8';
        const m = ct.match(/charset=([^;]+)/i);
        if (m) charset = m[1].trim().toLowerCase();
        const bodyStr = rawBuf.toString('utf8');
        const bodyB64 = rawBuf.toString('base64');
        send(res, 200, { status: resp.statusCode, headers: resp.headers, content_type: ct, charset, body: bodyStr, body_b64: bodyB64 });
      });
    });
    out.on('error', (err) => send(res, 502, { error: String(err && err.message || err) }));
    out.end();
    return;
  }
  if (req.method === 'GET' && u.pathname === '/check') {
    const num = u.searchParams.get('num') || '';
    const secUid = u.searchParams.get('sec_uid') || '';
    if (!num && !secUid) return send(res, 400, { error: 'missing num or sec_uid' });
    const timeoutMsRaw = u.searchParams.get('timeout_ms');
    let timeoutMs = 8000;
    if (timeoutMsRaw) {
      const v = Number(timeoutMsRaw);
      if (Number.isFinite(v)) timeoutMs = Math.min(Math.max(v, 1000), 60000);
    }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function randomTTWid() {
      const parts = [];
      for (let i = 0; i < 4; i++) parts.push(Math.random().toString(36).slice(2));
      return parts.join('');
    }
    function randomUA() {
      const osList = [
        'Macintosh; Intel Mac OS X 10_15_7',
        'Windows NT 10.0; Win64; x64',
        'X11; Linux x86_64'
      ];
      const os = osList[randInt(0, osList.length - 1)];
      const chromeMajor = randInt(120, 131);
      return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`;
    }
    const parsed = new URL('https://www.douyin.com/web/api/v2/user/info/?sec_uid=' + encodeURIComponent(secUid) + '&unique_id=' + encodeURIComponent(num));
    const client = https;
    const reqOptions = { method: 'GET', headers: { 'Accept': '*/*', 'Accept-Encoding': 'gzip, deflate, br', 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8', 'Connection': 'keep-alive', 'Referer': 'https://www.douyin.com', 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'same-site', 'User-Agent': randomUA(), 'Cookie': 'ttwid=' + randomTTWid() } };
    const out = client.request(parsed, reqOptions, (resp) => {
      const chunks = [];
      resp.on('data', (c) => chunks.push(c));
      resp.on('end', () => {
        const buf = Buffer.concat(chunks);
        const enc = String(resp.headers['content-encoding'] || '').toLowerCase();
        let rawBuf = buf;
        try {
          if (enc.includes('br')) rawBuf = zlib.brotliDecompressSync(buf);
          else if (enc.includes('gzip')) rawBuf = zlib.gunzipSync(buf);
          else if (enc.includes('deflate')) rawBuf = zlib.inflateSync(buf);
        } catch (_) {}
        const ct = String(resp.headers['content-type'] || '');
        let charset = 'utf-8';
        const m = ct.match(/charset=([^;]+)/i);
        if (m) charset = m[1].trim().toLowerCase();
        const bodyStr = rawBuf.toString('utf8');
        const bodyB64 = rawBuf.toString('base64');
        send(res, 200, { status: resp.statusCode, headers: resp.headers, content_type: ct, charset, body: bodyStr, body_b64: bodyB64 });
      });
    });
    out.setTimeout(timeoutMs);
    out.on('timeout', () => {
      out.destroy(new Error('timeout'));
    });
    out.on('error', (err) => send(res, 502, { error: String(err && err.message || err) }));
    out.end();
    return;
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }
  send(res, 404, { error: 'not found' });
}

if (!process.env.VERCEL) {
  const server = http.createServer(handleRequest);
  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = (req, res) => {
  handleRequest(req, res);
};
