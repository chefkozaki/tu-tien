const express = require('express');
const path = require('path');
const { timingSafeEqual } = require('crypto');
const fs = require('fs');
const https = require('https');
const net = require('net');
require('dotenv').config();

const { initDatabase } = require('../src/config/database');
const apiRouter = require('./routes/api');

const app = express();
const PORT = Number(process.env.SERVER_PORT || process.env.ADMIN_PORT || 3000);
const HOST = process.env.ADMIN_HOST || '0.0.0.0';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const TLS_KEY_PATH = process.env.ADMIN_TLS_KEY_PATH;
const TLS_CERT_PATH = process.env.ADMIN_TLS_CERT_PATH;
const TRUST_PROXY = process.env.ADMIN_TRUST_PROXY === 'true';

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('ADMIN_PORT must be an integer between 1 and 65535');
}
if (!ADMIN_USERNAME || !ADMIN_PASSWORD || Buffer.byteLength(ADMIN_PASSWORD) < 16) {
  throw new Error('Set ADMIN_USERNAME and an ADMIN_PASSWORD of at least 16 bytes before starting the admin panel');
}
if (Boolean(TLS_KEY_PATH) !== Boolean(TLS_CERT_PATH)) {
  throw new Error('Set both ADMIN_TLS_KEY_PATH and ADMIN_TLS_CERT_PATH to enable HTTPS');
}
const isLoopbackHost = ['localhost', '127.0.0.1', '::1'].includes(HOST)
  || (net.isIP(HOST) === 4 && HOST.startsWith('127.'));
if (!isLoopbackHost && !TLS_KEY_PATH && !TRUST_PROXY) {
  throw new Error('HTTPS certificates are required when the admin panel listens on a network interface');
}
if (TRUST_PROXY && TLS_KEY_PATH) {
  throw new Error('Use either platform-terminated HTTPS or local TLS certificates, not both');
}
if (TRUST_PROXY) {
  app.set('trust proxy', 1);
}
const tlsOptions = TLS_KEY_PATH && TLS_CERT_PATH
  ? {
      key: fs.readFileSync(TLS_KEY_PATH),
      cert: fs.readFileSync(TLS_CERT_PATH)
    }
  : null;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const authorization = req.get('authorization') || '';
  const encodedCredentials = authorization.match(/^Basic\s+(.+)$/i)?.[1];
  let credentials = '';

  if (encodedCredentials) {
    credentials = Buffer.from(encodedCredentials, 'base64').toString('utf8');
  }

  const separator = credentials.indexOf(':');
  const username = separator >= 0 ? credentials.slice(0, separator) : '';
  const password = separator >= 0 ? credentials.slice(separator + 1) : '';
  const suppliedUsername = Buffer.from(username);
  const suppliedPassword = Buffer.from(password);
  const expectedUsername = Buffer.from(ADMIN_USERNAME);
  const expectedPassword = Buffer.from(ADMIN_PASSWORD);
  const usernameMatches = suppliedUsername.length === expectedUsername.length
    && timingSafeEqual(suppliedUsername, expectedUsername);
  const passwordMatches = suppliedPassword.length === expectedPassword.length
    && timingSafeEqual(suppliedPassword, expectedPassword);

  if (!usernameMatches || !passwordMatches) {
    res.set('WWW-Authenticate', 'Basic realm="Tu Tien Admin", charset="UTF-8"');
    return res.status(401).type('text/plain').send('Authentication required');
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.get('origin')) {
    try {
      const requestHost = new URL(`${req.protocol}://${req.get('host')}`).host;
      const originHost = new URL(req.get('origin')).host;
      if (originHost !== requestHost) {
        return res.status(403).json({ success: false, error: 'Cross-origin admin requests are not allowed' });
      }
    } catch {
      return res.status(403).json({ success: false, error: 'Invalid request origin' });
    }
  }

  next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', apiRouter);

// SPA fallback for any unmatched GET request
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Admin Panel Server Error:', err);
  res.status(500).json({ success: false, error: err.message || 'Lỗi máy chủ nội bộ' });
});

let server = null;

async function startAdminServer(port = PORT) {
  try {
    // Ensure database is initialized
    await initDatabase();
  } catch (err) {
    console.warn('Database initialization warning:', err.message);
  }

  return new Promise((resolve, reject) => {
    const onListening = () => {
      console.log('====================================================');
      console.log(`🌌 [TU TIÊN VẤN ĐẠO] ADMIN PANEL ĐÃ KHỞI CHẠY THÀNH CÔNG!`);
      console.log(`🔗 Admin panel đang lắng nghe tại: ${tlsOptions ? 'https' : 'http'}://${HOST}:${port}`);
      console.log('🔒 Đã bật xác thực tài khoản admin.');
      if (tlsOptions) {
        console.log('   HTTPS được bật trực tiếp trên Admin Panel.');
      }
      console.log(`⚡ Quản lý toàn diện: Người chơi, Vật phẩm, Linh thú,`);
      console.log(`   Linh khí, Trợ thủ, Động Phủ, Tông Môn, Boss, Chợ Đen.`);
      console.log('====================================================');
      resolve(server);
    };

    server = tlsOptions
      ? https.createServer(tlsOptions, app).listen(port, HOST, onListening)
      : app.listen(port, HOST, onListening);
    server.once('error', reject);
  });
}

// If run directly: node admin/server.js
if (require.main === module) {
  startAdminServer();
}

module.exports = {
  app,
  startAdminServer
};
