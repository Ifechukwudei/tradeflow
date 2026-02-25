const db = require("../db");

const ProductModel = {
  async findAll() {
    const { rows } = await db.query(
      `SELECT p.*, i.qty_on_hand, i.qty_reserved,
              (i.qty_on_hand - i.qty_reserved) AS qty_available
       FROM products p
       LEFT JOIN inventory i ON i.product_id = p.id
       ORDER BY p.id`,
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await db.query(
      `SELECT p.*, i.qty_on_hand, i.qty_reserved,
              (i.qty_on_hand - i.qty_reserved) AS qty_available,
              i.reorder_point
       FROM products p
       LEFT JOIN inventory i ON i.product_id = p.id
       WHERE p.id = $1`,
      [id],
    );
    return rows[0] || null;
  },

  async create({
    name,
    sku,
    description,
    unit_price,
    initial_stock = 0,
    reorder_point = 0,
  }) {
    return db.withTransaction(async (client) => {
      const {
        rows: [product],
      } = await client.query(
        `INSERT INTO products (name, sku, description, unit_price)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, sku, description, unit_price],
      );

      await client.query(
        `INSERT INTO inventory (product_id, qty_on_hand, reorder_point)
         VALUES ($1, $2, $3)`,
        [product.id, initial_stock, reorder_point],
      );

      if (initial_stock > 0) {
        await client.query(
          `INSERT INTO inventory_adjustments (product_id, delta, reason)
           VALUES ($1, $2, 'Initial stock')`,
          [product.id, initial_stock],
        );
      }

      return {
        ...product,
        qty_on_hand: initial_stock,
        qty_reserved: 0,
        qty_available: initial_stock,
      };
    });
  },

  async update(id, { name, description, unit_price }) {
    const { rows } = await db.query(
      `UPDATE products
       SET name=$1, description=$2, unit_price=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [name, description, unit_price, id],
    );
    return rows[0] || null;
  },

  async delete(id) {
    const { rows } = await db.query(
      `DELETE FROM products WHERE id=$1 RETURNING *`,
      [id],
    );
    return rows[0] || null;
  },
};

module.exports = ProductModel;
