const db = require("../db");

const OrderModel = {
  async findAll() {
    const { rows } = await db.query(
      `SELECT o.*, c.name AS customer_name, c.email AS customer_email
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       ORDER BY o.id DESC`,
    );
    return rows;
  },

  async findById(id) {
    // Get the order header
    const {
      rows: [order],
    } = await db.query(
      `SELECT o.*, c.name AS customer_name, c.email AS customer_email
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.id = $1`,
      [id],
    );

    if (!order) return null;

    // Get the order line items
    const { rows: items } = await db.query(
      `SELECT oi.*, p.name AS product_name, p.sku
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [id],
    );

    return { ...order, items };
  },

  /**
   * Create an order and reserve inventory.
   * All or nothing — if any item lacks stock, the whole order fails.
   */
  async create({ customer_id, items, notes }) {
    return db.withTransaction(async (client) => {
      // 1. Lock and check inventory for every item in one go
      const productIds = items.map((i) => i.product_id);

      const { rows: inventoryRows } = await client.query(
        `SELECT i.product_id, i.qty_on_hand, i.qty_reserved,
                (i.qty_on_hand - i.qty_reserved) AS qty_available,
                p.unit_price, p.name
         FROM inventory i
         JOIN products p ON p.id = i.product_id
         WHERE i.product_id = ANY($1)
         FOR UPDATE`,
        [productIds],
      );

      // Index inventory by product_id for easy lookup
      const inventoryMap = {};
      inventoryRows.forEach((row) => {
        inventoryMap[row.product_id] = row;
      });

      // 2. Validate every item has enough stock
      for (const item of items) {
        const inv = inventoryMap[item.product_id];

        if (!inv) {
          throw new Error(`Product ID ${item.product_id} not found`);
        }

        if (item.quantity > inv.qty_available) {
          throw new Error(
            `Insufficient stock for "${inv.name}". ` +
              `Requested: ${item.quantity}, Available: ${inv.qty_available}`,
          );
        }
      }

      // 3. Calculate order total using prices from the DB (never trust client prices)
      let total_amount = 0;
      const enrichedItems = items.map((item) => {
        const inv = inventoryMap[item.product_id];
        const unit_price = parseFloat(inv.unit_price);
        total_amount += unit_price * item.quantity;
        return { ...item, unit_price };
      });

      // 4. Create the order header
      const {
        rows: [order],
      } = await client.query(
        `INSERT INTO orders (customer_id, total_amount, notes)
         VALUES ($1, $2, $3) RETURNING *`,
        [customer_id, total_amount.toFixed(2), notes],
      );

      // 5. Insert order line items
      for (const item of enrichedItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [order.id, item.product_id, item.quantity, item.unit_price],
        );
      }

      // 6. Reserve inventory for each item
      for (const item of items) {
        await client.query(
          `UPDATE inventory
           SET qty_reserved = qty_reserved + $1, updated_at = NOW()
           WHERE product_id = $2`,
          [item.quantity, item.product_id],
        );
      }

      // 7. Return the full order with items
      // 7. Return the full order with items
      const { rows: orderItems } = await client.query(
        `SELECT oi.*, p.name AS product_name, p.sku
   FROM order_items oi
   JOIN products p ON p.id = oi.product_id
   WHERE oi.order_id = $1`,
        [order.id],
      );

      return { ...order, items: orderItems };
    }); // End of withTransaction
  },

  async updateStatus(id, status) {
    const { rows } = await db.query(
      `UPDATE orders SET status=$1, updated_at=NOW()
       WHERE id=$2 RETURNING *`,
      [status, id],
    );
    return rows[0] || null;
  },

  async cancel(id) {
    return db.withTransaction(async (client) => {
      // Get the order and its items
      const {
        rows: [order],
      } = await client.query(`SELECT * FROM orders WHERE id=$1 FOR UPDATE`, [
        id,
      ]);

      if (!order) throw new Error("Order not found");
      if (["shipped", "invoiced", "paid"].includes(order.status)) {
        throw new Error(`Cannot cancel an order with status: ${order.status}`);
      }

      // Release reserved inventory
      const { rows: items } = await client.query(
        `SELECT * FROM order_items WHERE order_id=$1`,
        [id],
      );

      for (const item of items) {
        await client.query(
          `UPDATE inventory
           SET qty_reserved = qty_reserved - $1, updated_at = NOW()
           WHERE product_id = $2`,
          [item.quantity, item.product_id],
        );
      }

      // Update order status to cancelled
      const {
        rows: [updated],
      } = await client.query(
        `UPDATE orders SET status='cancelled', updated_at=NOW()
         WHERE id=$1 RETURNING *`,
        [id],
      );

      return updated;
    });
  },
};

module.exports = OrderModel;
