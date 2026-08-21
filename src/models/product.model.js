const db = require('../db');
const { paginate } = require('../utils/paginate');

const ProductModel = {
  async findAll(tenant_id, { page, limit, search } = {}) {
    const conditions = ['p.tenant_id = $1'];
    const params = [tenant_id];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const baseQuery = `
      SELECT p.*, i.qty_on_hand, i.qty_reserved,
             (i.qty_on_hand - i.qty_reserved) AS qty_available,
             i.reorder_point
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id AND i.tenant_id = p.tenant_id
      ${where}
      ORDER BY p.id
    `;

    return paginate(db, baseQuery, params, { page, limit });
  },

  async findById(tenant_id, id) {
    const { rows } = await db.query(
      `SELECT p.*, i.qty_on_hand, i.qty_reserved,
              (i.qty_on_hand - i.qty_reserved) AS qty_available,
              i.reorder_point
       FROM products p
       LEFT JOIN inventory i ON i.product_id = p.id AND i.tenant_id = p.tenant_id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [id, tenant_id]
    );
    return rows[0] || null;
  },

  async create(tenant_id, { name, sku, description, unit_price, initial_stock = 0, reorder_point = 0 }) {
    return db.withTransaction(async (client) => {
      const { rows: [product] } = await client.query(
        `INSERT INTO products (tenant_id, name, sku, description, unit_price)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [tenant_id, name, sku, description, unit_price]
      );

      await client.query(
        `INSERT INTO inventory (tenant_id, product_id, qty_on_hand, reorder_point)
         VALUES ($1, $2, $3, $4)`,
        [tenant_id, product.id, initial_stock, reorder_point]
      );

      if (initial_stock > 0) {
        await client.query(
          `INSERT INTO inventory_adjustments (tenant_id, product_id, delta, reason)
           VALUES ($1, $2, $3, 'Initial stock')`,
          [tenant_id, product.id, initial_stock]
        );
      }

      return { ...product, qty_on_hand: initial_stock, qty_reserved: 0, qty_available: initial_stock };
    });
  },

  async update(tenant_id, id, { name, description, unit_price }) {
    const { rows } = await db.query(
      `UPDATE products
       SET name=$1, description=$2, unit_price=$3, updated_at=NOW()
       WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [name, description, unit_price, id, tenant_id]
    );
    return rows[0] || null;
  },

  async delete(tenant_id, id) {
    const { rows } = await db.query(
      `DELETE FROM products WHERE id=$1 AND tenant_id=$2 RETURNING *`,
      [id, tenant_id]
    );
    return rows[0] || null;
  },
};

module.exports = ProductModel;
