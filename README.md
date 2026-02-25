# O2C & Inventory System

An Express.js REST API for Order-to-Cash and Inventory Management.

## Setup

```bash
npm install
cp .env.example .env   # fill in your DB credentials
npm run migrate        # creates tables
npm run dev            # start with hot reload
```

## Project Structure

```
src/
├── db/
│   ├── index.js          # DB pool + transaction helper
│   └── migrate.js        # Schema migrations
├── models/
│   ├── product.model.js  # Product DB queries
│   └── inventory.model.js
├── controllers/
│   ├── product.controller.js
│   └── inventory.controller.js
├── routes/
│   ├── product.routes.js
│   └── inventory.routes.js
└── index.js              # App entry point
```

## API Reference

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List all products with stock levels |
| GET | `/api/products/:id` | Get single product |
| POST | `/api/products` | Create product |
| PATCH | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |

**Create Product body:**
```json
{
  "name": "Widget A",
  "sku": "WGT-001",
  "description": "A great widget",
  "unit_price": 29.99,
  "initial_stock": 100,
  "reorder_point": 20
}
```

### Inventory

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory` | All stock levels |
| GET | `/api/inventory/low-stock` | Items at or below reorder point |
| POST | `/api/inventory/:product_id/adjust` | Adjust stock |
| GET | `/api/inventory/:product_id/history` | Adjustment history |
| PATCH | `/api/inventory/:product_id/reorder-point` | Update reorder point |

**Adjust Stock body:**
```json
{
  "delta": 50,
  "reason": "Received PO #1234"
}
```
Use a negative delta to remove stock (e.g. `"delta": -10`).

## Coming Next

- **Step 2:** Order creation with inventory reservation
- **Step 3:** Order fulfillment (ship → invoice → pay)
- **Step 4:** Reporting endpoints
