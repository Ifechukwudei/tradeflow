const db = require('../db');
const { paginate } = require('../utils/paginate');

const OrderModel = {
  async findAll(tenant_id, { page, limit, status, customer_id, from, to } = {}) {
    const conditions = ['o.tenant_id = $1'];
    const params = [tenant_id];

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

    const where = `WHERE ${conditions.join(' AND ')}`;

    const baseQuery = `
      SELECT o.*, c.name AS customer_name, c.email AS customer_email
      FROM orders o
      JOIN customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
      ${where}
      ORDER BY o.id DESC
    `;

    return paginate(db, baseQuery, params, { page, limit });
  },

  async findById(tenant_id, id) {
    const { rows: [order] } = await db.query(
      `SELECT o.*, c.name AS customer_name, c.email AS customer_email
       FROM orders o
       JOIN customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
       WHERE o.id = $1 AND o.tenant_id = $2`,
      [id, tenant_id]
    );

    if (!order) return null;

    const { rows: items } = await db.query(
      `SELECT oi.*, p.name AS product_name, p.sku
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id AND p.tenant_id = oi.tenant_id
       WHERE oi.order_id = $1 AND oi.tenant_id = $2`,
      [id, tenant_id]
    );

    return { ...order, items };
  },

  async create(tenant_id, { customer_id, items, notes }) {
    return db.withTransaction(async (client) => {
      // Verify customer belongs to tenant
      const { rows: [customer] } = await client.query(
        `SELECT id FROM customers WHERE id = $1 AND tenant_id = $2`,
        [customer_id, tenant_id]
      );
      if (!customer) throw new Error('Customer not found');

      const productIds = items.map((i) => i.product_id);

      const { rows: inventoryRows } = await client.query(
        `SELECT i.product_id, i.qty_on_hand, i.qty_reserved,
                (i.qty_on_hand - i.qty_reserved) AS qty_available,
                p.unit_price, p.name
         FROM inventory i
         JOIN products p ON p.id = i.product_id AND p.tenant_id = i.tenant_id
         WHERE i.product_id = ANY($1) AND i.tenant_id = $2
         FOR UPDATE`,
        [productIds, tenant_id]
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
        `INSERT INTO orders (tenant_id, customer_id, total_amount, notes)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [tenant_id, customer_id, total_amount.toFixed(2), notes]
      );

      for (const item of enrichedItems) {
        await client.query(
          `INSERT INTO order_items (tenant_id, order_id, product_id, quantity, unit_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [tenant_id, order.id, item.product_id, item.quantity, item.unit_price]
        );
      }

      for (const item of items) {
        await client.query(
          `UPDATE inventory
           SET qty_reserved = qty_reserved + $1, updated_at = NOW()
           WHERE product_id = $2 AND tenant_id = $3`,
          [item.quantity, item.product_id, tenant_id]
        );
      }

      const { rows: orderItems } = await client.query(
        `SELECT oi.*, p.name AS product_name, p.sku
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id AND p.tenant_id = oi.tenant_id
         WHERE oi.order_id = $1 AND oi.tenant_id = $2`,
        [order.id, tenant_id]
      );

      return { ...order, items: orderItems };
    });
  },

  async confirm(tenant_id, id) {
    const { rows: [order] } = await db.query(
      `SELECT * FROM orders WHERE id = $1 AND tenant_id = $2`, [id, tenant_id]
    );
    if (!order) throw new Error('Order not found');
    if (order.status !== 'pending') throw new Error(`Cannot confirm an order with status: ${order.status}`);

    const { rows: [updated] } = await db.query(
      `UPDATE orders SET status = 'confirmed', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenant_id]
    );
    return updated;
  },

  async ship(tenant_id, id) {
    return db.withTransaction(async (client) => {
      const { rows: [order] } = await client.query(
        `SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE`, [id, tenant_id]
      );
      if (!order) throw new Error('Order not found');
      if (order.status !== 'confirmed') throw new Error(`Cannot ship an order with status: ${order.status}`);

      const { rows: items } = await client.query(
        `SELECT * FROM order_items WHERE order_id = $1 AND tenant_id = $2`, [id, tenant_id]
      );

      for (const item of items) {
        await client.query(
          `UPDATE inventory
           SET qty_on_hand = qty_on_hand - $1,
               qty_reserved = qty_reserved - $1,
               updated_at = NOW()
           WHERE product_id = $2 AND tenant_id = $3`,
          [item.quantity, item.product_id, tenant_id]
        );

        await client.query(
          `INSERT INTO inventory_adjustments (tenant_id, product_id, delta, reason)
           VALUES ($1, $2, $3, $4)`,
          [tenant_id, item.product_id, -item.quantity, `Shipped on Order #${id}`]
        );
      }

      const { rows: [updated] } = await client.query(
        `UPDATE orders SET status = 'shipped', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        [id, tenant_id]
      );
      return updated;
    });
  },

  async cancel(tenant_id, id) {
    return db.withTransaction(async (client) => {
      const { rows: [order] } = await client.query(
        `SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE`, [id, tenant_id]
      );

      if (!order) throw new Error('Order not found');
      if (['shipped', 'invoiced', 'paid'].includes(order.status)) {
        throw new Error(`Cannot cancel an order with status: ${order.status}`);
      }

      const { rows: items } = await client.query(
        `SELECT * FROM order_items WHERE order_id = $1 AND tenant_id = $2`, [id, tenant_id]
      );

      for (const item of items) {
        await client.query(
          `UPDATE inventory
           SET qty_reserved = qty_reserved - $1, updated_at = NOW()
           WHERE product_id = $2 AND tenant_id = $3`,
          [item.quantity, item.product_id, tenant_id]
        );
      }

      const { rows: [updated] } = await client.query(
        `UPDATE orders SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        [id, tenant_id]
      );

      return updated;
    });
  },
};

module.exports = OrderModel;
