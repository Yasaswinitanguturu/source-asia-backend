const http = require('http');
const { handleRequest, handleStats } = require('./part1/handler');
const { handleProducts } = require('./part2/handler');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  const path = req.url.split('?')[0];

  if (path === '/request') {
    return handleRequest(req, res);
  }

  if (path === '/stats') {
    return handleStats(req, res);
  }

  if (path === '/products' || path.startsWith('/products/')) {
    return handleProducts(req, res);
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log('Routes:');
  console.log('  POST /request');
  console.log('  GET  /stats');
  console.log('  POST /products');
  console.log('  GET  /products?limit=20&offset=0');
  console.log('  GET  /products/:id');
  console.log('  POST /products/:id/media');
});