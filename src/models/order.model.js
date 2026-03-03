const db = require('../db');
const { paginate } = require('../utils/paginate');

const OrderModel = {
  async findAll({ page, limit, status, customer_id, from, to } = {}) {
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }
    if (customer_id) {
      params.push(customer_id);
      conditions.push(`o.customer_id = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`o.created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`o.created_at <= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const baseQuery = `
      SELECT o.*, c.name AS customer_name, c.email AS customer_email
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      ${where}
      ORDER BY o.id DESC
    `;

    return paginate(db, baseQuery, params, { page, limit });
  },

  async findById(id) {
    const { rows: [order] } = await db.query(
      `SELECT o.*, c.name AS customer_name, c.email AS customer_email
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.id = $1`,
      [id]
    );

    if (!order) return null;

    const { rows: items } = await db.query(
      `SELECT oi.*, p.name AS product_name, p.sku
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [id]
    );

    return { ...order, items };
  },

  async create({ customer_id, items, notes }) {
    return db.withTransaction(async (client) => {
      const productIds = items.map((i) => i.product_id);

      const { rows: inventoryRows } = await client.query(
        `SELECT i.product_id, i.qty_on_hand, i.qty_reserved,
                (i.qty_on_hand - i.qty_reserved) AS qty_available,
                p.unit_price, p.name
         FROM inventory i
         JOIN products p ON p.id = i.product_id
         WHERE i.product_id = ANY($1)
         FOR UPDATE`,
        [productIds]
      );

      const inventoryMap = {};
      inventoryRows.forEach((row) => { inventoryMap[row.product_id] = row; });

      for (const item of items) {
        const inv = inventoryMap[item.product_id];
        if (!inv) throw new Error(`Product ID ${item.product_id} not found`);
        if (item.quantity > inv.qty_available) {
          throw new Error(
            `Insufficient stock for "${inv.name}". ` +
            `Requested: ${item.quantity}, Available: ${inv.qty_available}`
          );
        }
      }

      let total_amount = 0;
      const enrichedItems = items.map((item) => {
        const inv = inventoryMap[item.product_id];
        const unit_price = parseFloat(inv.unit_price);
        total_amount += unit_price * item.quantity;
        return { ...item, unit_price };
      });

      const { rows: [order] } = await client.query(
        `INSERT INTO orders (customer_id, total_amount, notes)
         VALUES ($1, $2, $3) RETURNING *`,
        [customer_id, total_amount.toFixed(2), notes]
      );

      for (const item of enrichedItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [order.id, item.product_id, item.quantity, item.unit_price]
        );
      }

      for (const item of items) {
        await client.query(
          `UPDATE inventory
           SET qty_reserved = qty_reserved + $1, updated_at = NOW()
           WHERE product_id = $2`,
          [item.quantity, item.product_id]
        );
      }

      const { rows: orderItems } = await client.query(
        `SELECT oi.*, p.name AS product_name, p.sku
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1`,
        [order.id]
      );

      return { ...order, items: orderItems };
    });
  },

  async confirm(id) {
    const { rows: [order] } = await db.query(
      `SELECT * FROM orders WHERE id=$1`, [id]
    );
    if (!order) throw new Error('Order not found');
    if (order.status !== 'pending') throw new Error(`Cannot confirm an order with status: ${order.status}`);

    const { rows: [updated] } = await db.query(
      `UPDATE orders SET status='confirmed', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]
    );
    return updated;
  },

  async ship(id) {
    return db.withTransaction(async (client) => {
      const { rows: [order] } = await client.query(
        `SELECT * FROM orders WHERE id=$1 FOR UPDATE`, [id]
      );
      if (!order) throw new Error('Order not found');
      if (order.status !== 'confirmed') throw new Error(`Cannot ship an order with status: ${order.status}`);

      const { rows: items } = await client.query(
        `SELECT * FROM order_items WHERE order_id=$1`, [id]
      );

      for (const item of items) {
        await client.query(
          `UPDATE inventory
           SET qty_on_hand = qty_on_hand - $1,
               qty_reserved = qty_reserved - $1,
               updated_at = NOW()
           WHERE product_id = $2`,
          [item.quantity, item.product_id]
        );

        await client.query(
          `INSERT INTO inventory_adjustments (product_id, delta, reason)
           VALUES ($1, $2, $3)`,
          [item.product_id, -item.quantity, `Shipped on Order #${id}`]
        );
      }

      const { rows: [updated] } = await client.query(
        `UPDATE orders SET status='shipped', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]
      );
      return updated;
    });
  },

  async cancel(id) {
    return db.withTransaction(async (client) => {
      const { rows: [order] } = await client.query(
        `SELECT * FROM orders WHERE id=$1 FOR UPDATE`, [id]
      );

      if (!order) throw new Error('Order not found');
      if (['shipped', 'invoiced', 'paid'].includes(order.status)) {
        throw new Error(`Cannot cancel an order with status: ${order.status}`);
      }

      const { rows: items } = await client.query(
        `SELECT * FROM order_items WHERE order_id=$1`, [id]
      );

      for (const item of items) {
        await client.query(
          `UPDATE inventory
           SET qty_reserved = qty_reserved - $1, updated_at = NOW()
           WHERE product_id = $2`,
          [item.quantity, item.product_id]
        );
      }

      const { rows: [updated] } = await client.query(
        `UPDATE orders SET status='cancelled', updated_at=NOW()
         WHERE id=$1 RETURNING *`,
        [id]
      );

      return updated;
    });
  },
};

module.exports = OrderModel;
