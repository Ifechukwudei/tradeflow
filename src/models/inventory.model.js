const db = require('../db');
const { paginate } = require('../utils/paginate');

const InventoryModel = {
  async findAll({ page, limit, stock_status } = {}) {
    const conditions = [];
    const params = [];

    if (stock_status === 'low_stock') {
      conditions.push('(i.qty_on_hand - i.qty_reserved) <= i.reorder_point');
      conditions.push('(i.qty_on_hand - i.qty_reserved) > 0');
    } else if (stock_status === 'out_of_stock') {
      conditions.push('(i.qty_on_hand - i.qty_reserved) = 0');
    } else if (stock_status === 'ok') {
      conditions.push('(i.qty_on_hand - i.qty_reserved) > i.reorder_point');
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const baseQuery = `
      SELECT p.id AS product_id, p.name, p.sku,
             i.qty_on_hand, i.qty_reserved,
             (i.qty_on_hand - i.qty_reserved) AS qty_available,
             i.reorder_point,
             CASE WHEN (i.qty_on_hand - i.qty_reserved) = 0 THEN 'out_of_stock'
                  WHEN (i.qty_on_hand - i.qty_reserved) <= i.reorder_point THEN 'low_stock'
                  ELSE 'ok' END AS stock_status
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      ${where}
      ORDER BY p.id
    `;

    return paginate(db, baseQuery, params, { page, limit });
  },

  async getLowStock() {
    const { rows } = await db.query(
      `SELECT p.id AS product_id, p.name, p.sku,
              i.qty_on_hand, i.qty_reserved,
              (i.qty_on_hand - i.qty_reserved) AS qty_available,
              i.reorder_point
       FROM inventory i
       JOIN products p ON p.id = i.product_id
       WHERE (i.qty_on_hand - i.qty_reserved) <= i.reorder_point
       ORDER BY qty_available ASC`
    );
    return rows;
  },

  /**
   * Adjust stock for a product (positive = add, negative = remove).
   * Uses a transaction to keep qty and adjustment log in sync.
   */
  async adjust(product_id, delta, reason) {
    return db.withTransaction(async (client) => {
      // Lock the row to prevent race conditions
      const { rows } = await client.query(
        `SELECT * FROM inventory WHERE product_id = $1 FOR UPDATE`,
        [product_id]
      );

      if (!rows[0]) throw new Error('Inventory record not found for this product');

      const current = rows[0];
      const new_qty = current.qty_on_hand + delta;

      if (new_qty < 0) {
        throw new Error(`Insufficient stock. On hand: ${current.qty_on_hand}, requested adjustment: ${delta}`);
      }

      const { rows: [updated] } = await client.query(
        `UPDATE inventory SET qty_on_hand = $1, updated_at = NOW()
         WHERE product_id = $2 RETURNING *`,
        [new_qty, product_id]
      );

      await client.query(
        `INSERT INTO inventory_adjustments (product_id, delta, reason) VALUES ($1, $2, $3)`,
        [product_id, delta, reason || 'Manual adjustment']
      );

      return updated;
    });
  },

  async getAdjustmentHistory(product_id) {
    const { rows } = await db.query(
      `SELECT * FROM inventory_adjustments
       WHERE product_id = $1
       ORDER BY created_at DESC`,
      [product_id]
    );
    return rows;
  },

  async updateReorderPoint(product_id, reorder_point) {
    const { rows } = await db.query(
      `UPDATE inventory SET reorder_point = $1, updated_at = NOW()
       WHERE product_id = $2 RETURNING *`,
      [reorder_point, product_id]
    );
    return rows[0] || null;
  },
};

module.exports = InventoryModel;
