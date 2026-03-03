# Tradeflow API

A production-ready Order-to-Cash (O2C) and Inventory Management REST API built with Node.js, Express, and PostgreSQL.

---

## Table of Contents

- [Overview](#overview)
- [Application Flow](#application-flow)
- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [API Reference](#api-reference)

---

## Overview

Tradeflow handles the complete Order-to-Cash cycle:

```
Customer Places Order → Inventory Reserved → Order Confirmed →
Order Shipped → Invoice Generated → Payment Recorded
```

Every step is transaction-safe — inventory can never be oversold, and all stock movements are logged with a full audit trail.

---

## Application Flow

### The O2C Cycle

```
1. Create a Customer
2. Create Products + set initial stock
3. Customer places an Order   →  inventory is reserved
4. Staff confirms the Order   →  status: pending → confirmed
5. Order is Shipped           →  inventory deducted, status: shipped
6. Invoice is Generated       →  status: shipped → invoiced
7. Payment is Recorded        →  status: invoiced → paid
```

### Order Status Lifecycle

```
pending → confirmed → shipped → invoiced → paid
    ↓           ↓
  cancel      cancel
```

### Inventory Numbers Explained

| Field         | Meaning                                        |
| ------------- | ---------------------------------------------- |
| qty_on_hand   | Physically in the warehouse                    |
| qty_reserved  | Spoken for by pending/confirmed orders         |
| qty_available | What can actually be sold (on_hand - reserved) |

---

## Getting Started

### Prerequisites

- Node.js v18+
- Docker Desktop

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/tradeflow.git
cd tradeflow

# 2. Install dependencies
npm install

# 3. Start Postgres with Docker
docker run --name tradeflow-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=yourpassword -e POSTGRES_DB=o2c_db -p 5432:5432 -d postgres

# 4. Set up environment variables
cp .env.example .env

# 5. Run database migrations
npm run migrate

# 6. Start the server
npm run dev
```

### Environment Variables (.env)

```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=o2c_db
DB_USER=postgres
DB_PASSWORD=yourpassword
JWT_SECRET=your-long-random-secret
JWT_EXPIRES_IN=7d
```

---

## Authentication

All endpoints except /api/auth/register and /api/auth/login require a Bearer token.

### How to authenticate in Thunder Client

1. Call POST /api/auth/login and copy the token from the response
2. On any request click the Auth tab
3. Select Bearer from the dropdown
4. Paste your token

### Roles

| Role   | Access                                 |
| ------ | -------------------------------------- |
| admin  | Full access to everything              |
| staff  | Can manage orders, products, inventory |
| viewer | Read-only access to reports            |

---

## API Reference

### Auth Endpoints

**Register**

```
POST /api/auth/register
Body: { "name": "Admin User", "email": "admin@tradeflow.com", "password": "password123", "role": "admin" }
```

**Login**

```
POST /api/auth/login
Body: { "email": "admin@tradeflow.com", "password": "password123" }
Returns a token — use this on all subsequent requests.
```

**Get current user**

```
GET /api/auth/me
Requires: Bearer token
```

**List all users (admin only)**

```
GET /api/auth/users
```

**Update user role (admin only)**

```
PATCH /api/auth/users/:id/role
Body: { "role": "staff" }
```

---

### Product Endpoints

**List all products**

```
GET /api/products
Returns products with current stock levels.
```

**Get a single product**

```
GET /api/products/:id
```

**Create a product**

```
POST /api/products
Body:
{
  "name": "Widget A",
  "sku": "WGT-001",
  "description": "A great widget",
  "unit_price": 29.99,
  "initial_stock": 100,
  "reorder_point": 20
}

Fields:
  name          required  Product name
  sku           required  Unique stock keeping unit
  unit_price    required  Price per unit
  description   optional  Product description
  initial_stock optional  Starting stock level (default: 0)
  reorder_point optional  Low stock alert threshold (default: 0)
```

**Update a product**

```
PATCH /api/products/:id
Body: { "name": "Widget A Pro", "unit_price": 34.99 }
```

**Delete a product**

```
DELETE /api/products/:id
```

---

### Inventory Endpoints

**List all stock levels**

```
GET /api/inventory
```

**Get low stock items**

```
GET /api/inventory/low-stock
Returns products at or below their reorder point.
```

**Adjust stock manually**

```
POST /api/inventory/:product_id/adjust
Body: { "delta": 50, "reason": "Received PO #1234" }
Use a negative delta to remove stock e.g. "delta": -10
```

**Get adjustment history**

```
GET /api/inventory/:product_id/history
```

**Update reorder point**

```
PATCH /api/inventory/:product_id/reorder-point
Body: { "reorder_point": 25 }
```

---

### Customer Endpoints

**List all customers**

```
GET /api/customers
```

**Get a single customer**

```
GET /api/customers/:id
```

**Create a customer**

```
POST /api/customers
Body:
{
  "name": "Acme Corp",
  "email": "orders@acme.com",
  "phone": "123-456-7890",
  "address": "123 Business St, Lagos"
}
```

**Update a customer**

```
PATCH /api/customers/:id
Body: { "phone": "987-654-3210", "address": "456 New Address" }
```

---

### Order Endpoints

**List all orders**

```
GET /api/orders
```

**Get a single order with line items**

```
GET /api/orders/:id
```

**Create an order**

```
POST /api/orders
Body:
{
  "customer_id": 1,
  "items": [
    { "product_id": 1, "quantity": 5 },
    { "product_id": 2, "quantity": 2 }
  ],
  "notes": "Urgent delivery"
}

Important:
- If any item has insufficient stock, the entire order fails and nothing is reserved
- Prices are always pulled from the database, never from the request body
```

**Confirm an order**

```
PATCH /api/orders/:id/confirm
Moves status: pending → confirmed
No inventory changes at this stage.
```

**Ship an order**

```
PATCH /api/orders/:id/ship
Moves status: confirmed → shipped
Deducts qty_on_hand and releases qty_reserved for all items.
Order must be confirmed first.
```

**Generate an invoice**

```
PATCH /api/orders/:id/invoice
Body: { "due_days": 30 }
Moves status: shipped → invoiced
Order must be shipped first.
```

**Cancel an order**

```
PATCH /api/orders/:id/cancel
Releases all reserved inventory.
Only works on pending or confirmed orders.
```

---

### Invoice Endpoints

**List all invoices**

```
GET /api/invoices
```

**Get a single invoice with payment history**

```
GET /api/invoices/:id
```

**Record a payment**

```
POST /api/invoices/:id/payments
Body:
{
  "amount": 149.95,
  "payment_method": "bank_transfer",
  "reference": "TXN-001",
  "notes": "Full payment received"
}

Payment methods: bank_transfer, credit_card, cash, cheque

Supports partial payments:
- Invoice status → partial (until fully paid)
- Invoice status → paid (when amount_paid >= amount_due)
- Order status   → paid (automatically when invoice is fully paid)
```

---

### Report Endpoints

**Revenue summary**

```
GET /api/reports/revenue
GET /api/reports/revenue?from=2026-01-01&to=2026-12-31

Returns: total_orders, total_revenue, avg_order_value, total_collected, total_outstanding
```

**Order pipeline**

```
GET /api/reports/orders-summary
Returns: count and value of orders grouped by status
```

**Top selling products**

```
GET /api/reports/top-products
GET /api/reports/top-products?limit=5
Returns: products ranked by revenue, with units sold and order count
```

**Inventory status**

```
GET /api/reports/inventory-status
Returns: all products with stock levels and status flags (ok, low_stock, out_of_stock)
```

**Payments summary**

```
GET /api/reports/payments-summary
Returns: total invoiced, collected, outstanding, and overdue invoice counts
```

---

## Project Structure

```
src/
├── db/
│   ├── index.js                connection pool and transaction helper
│   └── migrate.js              database schema migrations
├── middleware/
│   └── auth.middleware.js      JWT verification and role authorization
├── models/
│   ├── user.model.js
│   ├── product.model.js
│   ├── inventory.model.js
│   ├── customer.model.js
│   ├── order.model.js
│   ├── invoice.model.js
│   └── reports.model.js
├── controllers/
│   ├── auth.controller.js
│   ├── product.controller.js
│   ├── inventory.controller.js
│   ├── customer.controller.js
│   ├── order.controller.js
│   ├── invoice.controller.js
│   └── reports.controller.js
├── routes/
│   ├── auth.routes.js
│   ├── product.routes.js
│   ├── inventory.routes.js
│   ├── customer.routes.js
│   ├── order.routes.js
│   ├── invoice.routes.js
│   └── reports.routes.js
└── index.js                    app entry point
```
