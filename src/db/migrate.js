const { query } = require("/index");

const migrate = async () => {
  console.log("Running migrations...");

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

  // Inventory table (one row per product)
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

  console.log("✅ Migrations complete.");
  process.exit(0);
};

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
