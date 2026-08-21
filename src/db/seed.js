const bcrypt = require("bcrypt");
const { query, withTransaction } = require("./index");

const SALT_ROUNDS = 12;

async function seed() {
  console.log("🌱 Starting TradeFlow multi-tenant database seeding...");

  try {
    // 1. Seed Tenant 1: Acme Global Logistics
    const tenantRes1 = await query(
      `INSERT INTO tenants (company_name) VALUES ($1) RETURNING *`,
      ["Acme Global Logistics"]
    );
    const tenant1 = tenantRes1.rows[0];
    console.log(`✓ Created Tenant 1: ${tenant1.company_name} (ID: ${tenant1.id})`);

    // 2. Seed Tenant 2: Nexus Cloud Corp (for testing multi-tenant isolation)
    const tenantRes2 = await query(
      `INSERT INTO tenants (company_name) VALUES ($1) RETURNING *`,
      ["Nexus Cloud Corp"]
    );
    const tenant2 = tenantRes2.rows[0];
    console.log(`✓ Created Tenant 2: ${tenant2.company_name} (ID: ${tenant2.id})`);

    const passwordHash = await bcrypt.hash("Password123!", SALT_ROUNDS);

    // 3. Seed Users for Tenant 1
    const adminUser = await query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin') RETURNING *`,
      [tenant1.id, "Sarah Jenkins", "admin@tradeflow.com", passwordHash]
    );
    const staffUser = await query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'staff') RETURNING *`,
      [tenant1.id, "Michael Scott", "staff@tradeflow.com", passwordHash]
    );
    console.log(`✓ Created Admin (admin@tradeflow.com) & Staff (staff@tradeflow.com)`);

    // Seed User for Tenant 2
    await query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin') RETURNING *`,
      [tenant2.id, "Nexus Admin", "admin@nexuscloud.com", passwordHash]
    );

    // 4. Seed Products & Inventory for Tenant 1
    const productsData = [
      { name: "Enterprise Server Blade X9", sku: "SRV-X900", price: 2499.00, stock: 45, reorder: 10 },
      { name: "10GbE Fiber Switch 24-Port", sku: "NET-FS24", price: 899.50, stock: 8, reorder: 12 }, // Low stock
      { name: "Cat6A Shielded Cable 1000ft", sku: "CAB-C6A-1K", price: 185.00, stock: 120, reorder: 25 },
      { name: "42U Modular Server Rack", sku: "RCK-42U-MOD", price: 1450.00, stock: 3, reorder: 5 }, // Low stock
      { name: "3kVA Rackmount UPS", sku: "PWR-UPS-3K", price: 799.00, stock: 30, reorder: 8 },
    ];

    const seededProducts = [];
    for (const p of productsData) {
      const prodRes = await query(
        `INSERT INTO products (tenant_id, name, sku, description, unit_price)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [tenant1.id, p.name, p.sku, `High performance ${p.name}`, p.price]
      );
      const prod = prodRes.rows[0];
      seededProducts.push(prod);

      await query(
        `INSERT INTO inventory (tenant_id, product_id, qty_on_hand, qty_reserved, reorder_point)
         VALUES ($1, $2, $3, 0, $4)`,
        [tenant1.id, prod.id, p.stock, p.reorder]
      );

      await query(
        `INSERT INTO inventory_adjustments (tenant_id, product_id, delta, reason)
         VALUES ($1, $2, $3, 'Initial inventory stocking')`,
        [tenant1.id, prod.id, p.stock]
      );
    }
    console.log(`✓ Created ${seededProducts.length} Products & Stock Levels for Tenant 1`);

    // 5. Seed Customers for Tenant 1
    const cust1 = await query(
      `INSERT INTO customers (tenant_id, name, email, phone, address)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenant1.id, "Starlight Tech Inc", "procurement@starlight.io", "+1 (555) 123-4567", "500 Innovation Blvd, Austin, TX"]
    );
    const cust2 = await query(
      `INSERT INTO customers (tenant_id, name, email, phone, address)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenant1.id, "Apex Data Solutions", "accounts@apexdata.com", "+1 (555) 987-6543", "120 Market St, Seattle, WA"]
    );
    console.log(`✓ Created Customers: Starlight Tech & Apex Data`);

    // 6. Seed an Order with Invoice and Payment for Tenant 1
    const customer = cust1.rows[0];
    const orderRes = await query(
      `INSERT INTO orders (tenant_id, customer_id, status, total_amount, notes)
       VALUES ($1, $2, 'paid', $3, 'Annual datacenter refresh') RETURNING *`,
      [tenant1.id, customer.id, 5897.50]
    );
    const order = orderRes.rows[0];

    await query(
      `INSERT INTO order_items (tenant_id, order_id, product_id, quantity, unit_price, total_price)
       VALUES ($1, $2, $3, 2, $4, $5)`,
      [tenant1.id, order.id, seededProducts[0].id, seededProducts[0].unit_price, 4998.00]
    );
    await query(
      `INSERT INTO order_items (tenant_id, order_id, product_id, quantity, unit_price, total_price)
       VALUES ($1, $2, $3, 1, $4, $5)`,
      [tenant1.id, order.id, seededProducts[1].id, seededProducts[1].unit_price, 899.50]
    );

    const invRes = await query(
      `INSERT INTO invoices (tenant_id, order_id, invoice_number, amount_due, amount_paid, due_date, status)
       VALUES ($1, $2, 'INV-2026-001', 5897.50, 5897.50, NOW() + INTERVAL '30 days', 'paid') RETURNING *`,
      [tenant1.id, order.id]
    );
    const invoice = invRes.rows[0];

    await query(
      `INSERT INTO payments (tenant_id, invoice_id, amount, payment_method, reference, notes)
       VALUES ($1, $2, 5897.50, 'bank_transfer', 'WIRE-TX-99401', 'Settled in full via wire')`,
      [tenant1.id, invoice.id]
    );
    console.log(`✓ Created Sample Order #${order.id}, Invoice #${invoice.invoice_number}, and Payment`);

    console.log("\n✨ Database seeding completed successfully!");
    console.log("-------------------------------------------------------");
    console.log("Demo Credentials:");
    console.log("  Tenant: Acme Global Logistics");
    console.log("  Admin:  admin@tradeflow.com / Password123!");
    console.log("  Staff:  staff@tradeflow.com / Password123!");
    console.log("-------------------------------------------------------");

  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  seed().then(() => process.exit(0));
}

module.exports = { seed };
