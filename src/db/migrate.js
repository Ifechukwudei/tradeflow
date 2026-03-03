const { query } = require('./index');

const migrate = async () => {
  console.log('Running migrations...');

  // Users table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(255) NOT NULL,
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role          VARCHAR(50) NOT NULL DEFAULT 'staff'
                    CHECK (role IN ('admin', 'staff', 'viewer')),
      is_active     BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Products table
  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) NOT NULL,
      sku         VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      unit_price  NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Inventory table
  await query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id            SERIAL PRIMARY KEY,
      product_id    INTEGER UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      qty_on_hand   INTEGER NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
      qty_reserved  INTEGER NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
      reorder_point INTEGER NOT NULL DEFAULT 0,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Inventory adjustment log
  await query(`
    CREATE TABLE IF NOT EXISTS inventory_adjustments (
      id          SERIAL PRIMARY KEY,
      product_id  INTEGER NOT NULL REFERENCES products(id),
      delta       INTEGER NOT NULL,
      reason      VARCHAR(255),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Customers table
  await query(`
    CREATE TABLE IF NOT EXISTS customers (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(255) NOT NULL,
      email      VARCHAR(255) UNIQUE NOT NULL,
      phone      VARCHAR(50),
      address    TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Orders table
  await query(`
    CREATE TABLE IF NOT EXISTS orders (
      id           SERIAL PRIMARY KEY,
      customer_id  INTEGER NOT NULL REFERENCES customers(id),
      status       VARCHAR(50) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'shipped', 'invoiced', 'paid', 'cancelled')),
      total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      notes        TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Order items table
  await query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id          SERIAL PRIMARY KEY,
      order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id  INTEGER NOT NULL REFERENCES products(id),
      quantity    INTEGER NOT NULL CHECK (quantity > 0),
      unit_price  NUMERIC(12, 2) NOT NULL,
      total_price NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Invoices table
  await query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id             SERIAL PRIMARY KEY,
      order_id       INTEGER UNIQUE NOT NULL REFERENCES orders(id),
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      amount_due     NUMERIC(12, 2) NOT NULL,
      amount_paid    NUMERIC(12, 2) NOT NULL DEFAULT 0,
      due_date       DATE NOT NULL,
      status         VARCHAR(50) NOT NULL DEFAULT 'unpaid'
                     CHECK (status IN ('unpaid', 'partial', 'paid')),
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Payments table
  await query(`
    CREATE TABLE IF NOT EXISTS payments (
      id             SERIAL PRIMARY KEY,
      invoice_id     INTEGER NOT NULL REFERENCES invoices(id),
      amount         NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer'
                     CHECK (payment_method IN ('bank_transfer', 'credit_card', 'cash', 'cheque')),
      reference      VARCHAR(255),
      notes          TEXT,
      paid_at        TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log('✅ Migrations complete.');
  process.exit(0);
};

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
