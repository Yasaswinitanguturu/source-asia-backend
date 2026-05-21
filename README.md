# Source Asia Backend Assignment

Built with Node.js standard library only. No external dependencies.

## How to Run Locally

```bash
node index.js
```

Server starts at `http://localhost:8080`

## Live Deployment

Deployed on Render: `https://source-asia-backend.onrender.com`

---

## Project Structure

```
source-asia-backend/
├── index.js              ← Entry point, starts the HTTP server
├── package.json          ← Project config
├── README.md             ← This file
├── part1/
│   ├── rateLimiter.js    ← Rate limiting logic
│   └── handler.js        ← /request and /stats route handlers
└── part2/
    ├── store.js          ← In-memory product storage
    └── handler.js        ← Product route handlers
```

---

## Part 1 – Rate Limiting

### Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Window type | Fixed 1-minute window | Simple and predictable |
| Success status | 201 Created | Request was created/accepted |
| Rejected count | Cumulative (never resets) | Tracks all-time abuse per user |
| Concurrency | Node.js single-threaded | In-memory ops are safe from race conditions |

### Endpoints

#### POST /request

Request body:
```json
{
  "user_id": "alice",
  "payload": { "any": "value" }
}
```

Success — 201 Created:
```json
{
  "message": "Request accepted",
  "user_id": "alice",
  "payload": { "any": "value" },
  "accepted_in_window": 1
}
```

Rate limited — 429 Too Many Requests:
```json
{
  "error": "Rate limit exceeded. Maximum 5 requests per minute.",
  "accepted_in_window": 5,
  "rejected_total": 1
}
```

Invalid input — 400 Bad Request:
```json
{
  "error": "user_id is required and must be a non-empty string"
}
```

#### GET /stats

Response — 200 OK:
```json
{
  "users": {
    "alice": {
      "accepted_in_window": 3,
      "rejected_total": 2
    },
    "bob": {
      "accepted_in_window": 1,
      "rejected_total": 0
    }
  }
}
```

### Rate Limiting Rules
- Maximum **5 accepted requests** per `user_id` per **fixed 1-minute window**
- Window resets 60 seconds after the user's first request in that window
- Rejected count is **cumulative** — it never resets across windows
- Exceeding the limit returns **429 Too Many Requests**

### Production Limitations
- **Single instance only** — state lives in memory, not shared across servers
- **Restart loses all state** — no persistence
- **Multi-instance deployment** needs Redis or a distributed cache
- **Fixed window** can allow a burst at window boundary (sliding window would fix this)
- **No authentication** — user_id is trust-based

---

## Part 2 – Product Catalog

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /products | Create a new product |
| GET | /products?limit=20&offset=0 | List products (no media arrays) |
| GET | /products/:id | Full product detail with all URLs |
| POST | /products/:id/media | Append media URLs to a product |

### Pagination
- Query params: `limit` and `offset`
- Default: `limit=20`, `offset=0`
- Maximum limit: `100`

### Validation Rules
- `name` and `sku` must be non-empty strings
- URLs must start with `http://` or `https://`
- URLs max length: **2048 characters**
- Max **20 URLs** per array per request
- Duplicate `sku` returns **409 Conflict**

### POST /products

Request:
```json
{
  "name": "Widget A",
  "sku": "SKU-001",
  "image_urls": [
    "https://cdn.example.com/products/sku-001/img-1.jpg",
    "https://cdn.example.com/products/sku-001/img-2.jpg"
  ],
  "video_urls": [
    "https://cdn.example.com/products/sku-001/demo.mp4"
  ]
}
```

Success — 201 Created:
```json
{
  "id": "prod_1",
  "name": "Widget A",
  "sku": "SKU-001",
  "image_urls": ["https://cdn.example.com/products/sku-001/img-1.jpg"],
  "video_urls": ["https://cdn.example.com/products/sku-001/demo.mp4"],
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

### GET /products?limit=5&offset=0

Success — 200 OK:
```json
{
  "data": [
    {
      "id": "prod_1",
      "name": "Widget A",
      "sku": "SKU-001",
      "image_count": 2,
      "video_count": 1,
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 5
}
```

> Notice: `image_count` and `video_count` are returned instead of full URL arrays.
> This keeps the list endpoint fast even with 1000+ products.

### GET /products/:id

Success — 200 OK:
```json
{
  "id": "prod_1",
  "name": "Widget A",
  "sku": "SKU-001",
  "image_urls": [
    "https://cdn.example.com/products/sku-001/img-1.jpg",
    "https://cdn.example.com/products/sku-001/img-2.jpg"
  ],
  "video_urls": [
    "https://cdn.example.com/products/sku-001/demo.mp4"
  ],
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

### POST /products/:id/media

Request:
```json
{
  "image_urls": ["https://cdn.example.com/products/sku-001/img-3.jpg"],
  "video_urls": ["https://cdn.example.com/products/sku-001/demo2.mp4"]
}
```

Success — 200 OK: returns the full updated product.

---

## Data Model

Products are stored in plain JS objects in memory:

```
products  = { "prod_1": { id, name, sku, image_urls, video_urls, created_at } }
skuIndex  = { "SKU-001": "prod_1" }    ← O(1) duplicate SKU check
orderedIds = ["prod_1", "prod_2", ...]  ← insertion order for pagination
```

### List vs Detail Design

| Endpoint | Returns | Why |
|----------|---------|-----|
| GET /products | id, name, sku, image_count, video_count, created_at | Never loads URL arrays — stays fast at scale |
| GET /products/:id | Full product including all image_urls and video_urls | Detail page needs everything |

With **1,000 products × 10 images each**, `GET /products?limit=20` only
touches 20 products and returns counts — never serializes 10,000 URLs.

### What Would Change with PostgreSQL + CDN

- **Products table**: `id, name, sku, created_at`
- **Media table**: `id, product_id, url, type (image/video), sort_order`
- **List query**: `SELECT p.*, COUNT(m.id) as media_count FROM products p LEFT JOIN media m ON m.product_id = p.id GROUP BY p.id LIMIT 20 OFFSET 0`
- **Detail query**: `SELECT * FROM products WHERE id = $1` + separate `SELECT * FROM media WHERE product_id = $1`
- **CDN**: Store only relative paths in DB (e.g. `/products/sku-001/img-1.jpg`), prepend CDN base URL at response time

---

## AI Tools Used

## AI Tools Used

Claude (Anthropic) was used to assist with writing and structuring parts of
the code, including rate limiting logic, API route handling, and in-memory
data model design. Concepts were learned and understood during the process.