const products = {};
const skuIndex = {};
const orderedIds = [];
let counter = 0;

function createProduct(name, sku, imageUrls = [], videoUrls = []) {
  if (skuIndex[sku]) {
    return { error: 'DUPLICATE_SKU' };
  }

  counter++;
  const id = `prod_${counter}`;

  const product = {
    id,
    name,
    sku,
    image_urls: imageUrls,
    video_urls: videoUrls,
    created_at: new Date().toISOString(),
  };

  products[id] = product;
  skuIndex[sku] = id;
  orderedIds.push(id);

  return { product };
}

function getProductById(id) {
  return products[id] || null;
}

function listProducts(offset = 0, limit = 20) {
  const total = orderedIds.length;
  const pageIds = orderedIds.slice(offset, offset + limit);

  const items = pageIds.map((id) => {
    const p = products[id];
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      image_count: p.image_urls.length,
      video_count: p.video_urls.length,
      created_at: p.created_at,
    };
  });

  return { items, total };
}

function addMedia(id, imageUrls = [], videoUrls = []) {
  const product = products[id];
  if (!product) return null;

  product.image_urls.push(...imageUrls);
  product.video_urls.push(...videoUrls);
  return product;
}

module.exports = { createProduct, getProductById, listProducts, addMedia };