const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Proxy server is running. Use /api endpoint for AI requests.');
});

app.use('/api', createProxyMiddleware({
  target: 'https://api.tensorix.ai',
  changeOrigin: true,
  secure: true,
  pathRewrite: {
    '^/api': '/v1'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`\n=== Proxy Request ===`);
    console.log(`Method: ${req.method}`);
    console.log(`URL: ${req.url}`);
    console.log(`Target: https://api.tensorix.ai/v1${req.url.replace('/api', '')}`);
    console.log(`Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`Body:`, req.body ? JSON.stringify(req.body, null, 2) : 'none');
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`\n=== Proxy Response ===`);
    console.log(`Status: ${proxyRes.statusCode}`);
    console.log(`Headers:`, JSON.stringify(proxyRes.headers, null, 2));
  },
  onError: (err, req, res) => {
    console.error('\n=== Proxy Error ===');
    console.error('Error:', err);
    console.error('Code:', err.code);
    console.error('Message:', err.message);
    res.status(500).json({ error: 'Proxy error', message: err.message, code: err.code });
  }
}));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/chat/completions`);
});
