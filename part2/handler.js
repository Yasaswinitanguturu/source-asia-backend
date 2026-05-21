const { createProduct, getProductById, listProducts, addMedia } = require('./store');

const MAX_URLS_PER_REQUEST = 20;
const MAX_URL_LENGTH = 2048;

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function isValidUrl(str) {
  if (typeof str !== 'string' || str.length > MAX_URL_LENGTH) return false;
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateUrls(arr, fieldName) {
  if (!Array.isArray(arr)) return `${fieldName} must be an array`;
  if (arr.length > MAX_URLS_PER_REQUEST)
    return `${fieldName}: max ${MAX_URLS_PER_REQUEST} URLs allowed per request`;
  for (const url of arr) {
    if (!isValidUrl(url))
      return `${fieldName}: "${url}" is not a valid http/https URL (max ${MAX_URL_LENGTH} chars)`;
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

async function handleCreateProduct(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJSON(res, 400, { error: 'Invalid JSON body' });
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    return sendJSON(res, 400, { error: 'name is required and must be a non-empty string' });
  }
  if (!body.sku || typeof body.sku !== 'string' || body.sku.trim() === '') {
    return sendJSON(res, 400, { error: 'sku is required and must be a non-empty string' });
  }

  const imageUrls = body.image_urls || [];
  const videoUrls = body.video_urls || [];

  const imgError = validateUrls(imageUrls, 'image_urls');
  if (imgError) return sendJSON(res, 400, { error: imgError });

  const vidError = validateUrls(videoUrls, 'video_urls');
  if (vidError) return sendJSON(res, 400, { error: vidError });

  const result = createProduct(body.name.trim(), body.sku.trim(), imageUrls, videoUrls);

  if (result.error === 'DUPLICATE_SKU') {
    return sendJSON(res, 409, { error: 'A product with this SKU already exists' });
  }

  return sendJSON(res, 201, result.product);
}

function handleListProducts(req, res) {
  const urlObj = new URL(req.url, 'http://localhost');
  let limit = parseInt(urlObj.searchParams.get('limit')) || 20;
  let offset = parseInt(urlObj.searchParams.get('offset')) || 0;

  if (limit > 100) limit = 100;
  if (limit < 1) limit = 20;
  if (offset < 0) offset = 0;

  const { items, total } = listProducts(offset, limit);

  return sendJSON(res, 200, {
    data: items,
    total,
    offset,
    limit,
  });
}

function handleGetProduct(req, res, id) {
  const product = getProductById(id);
  if (!product) {
    return sendJSON(res, 404, { error: 'Product not found' });
  }
  return sendJSON(res, 200, product);
}

async function handleAddMedia(req, res, id) {
  const product = getProductById(id);
  if (!product) {
    return sendJSON(res, 404, { error: 'Product not found' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJSON(res, 400, { error: 'Invalid JSON body' });
  }

  const imageUrls = body.image_urls || [];
  const videoUrls = body.video_urls || [];

  if (imageUrls.length === 0 && videoUrls.length === 0) {
    return sendJSON(res, 400, { error: 'At least one of image_urls or video_urls is required' });
  }

  const imgError = validateUrls(imageUrls, 'image_urls');
  if (imgError) return sendJSON(res, 400, { error: imgError });

  const vidError = validateUrls(videoUrls, 'video_urls');
  if (vidError) return sendJSON(res, 400, { error: vidError });

  const updated = addMedia(id, imageUrls, videoUrls);
  return sendJSON(res, 200, updated);
}

async function handleProducts(req, res) {
  const urlPath = req.url.split('?')[0];
  const parts = urlPath.replace(/^\/products\/?/, '').split('/');

  const id = parts[0];
  const subPath = parts[1];

  if (!id || id === '') {
    if (req.method === 'POST') return handleCreateProduct(req, res);
    if (req.method === 'GET') return handleListProducts(req, res);
    return sendJSON(res, 405, { error: 'Method not allowed' });
  }

  if (subPath === 'media') {
    if (req.method === 'POST') return handleAddMedia(req, res, id);
    return sendJSON(res, 405, { error: 'Method not allowed' });
  }

  if (req.method === 'GET') return handleGetProduct(req, res, id);
  return sendJSON(res, 405, { error: 'Method not allowed' });
}

module.exports = { handleProducts };