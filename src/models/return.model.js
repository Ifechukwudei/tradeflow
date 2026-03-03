const db = require("../db");
const { paginate } = require("../utils/paginate");

const generateCreditNoteNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `CN-${date}-${random}`;
};

const ReturnModel = {
  async findAll({ page, limit, status } = {}) {
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`r.status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const baseQuery = `
      SELECT r.*, c.name AS customer_name, o.total_amount AS order_total
      FROM returns r
      JOIN orders o ON o.id = r.order_id
      JOIN customers c ON c.id = o.customer_id
      ${where}
      ORDER BY r.id DESC
    `;

    return paginate(db, baseQuery, params, { page, limit });
  },

  async findById(id) {
    const {
      rows: [ret],
    } = await db.query(
      `SELECT r.*, c.name AS customer_name, o.total_amount AS order_total
       FROM returns r
       JOIN orders o ON o.id = r.order_id
       JOIN customers c ON c.id = o.customer_id
       WHERE r.id = $1`,
      [id],
    );

    if (!ret) return null;

    const { rows: items } = await db.query(
      `SELECT ri.*, p.name AS product_name, p.sku, p.unit_price
       FROM return_items ri
       JOIN products p ON p.id = ri.product_id
       WHERE ri.return_id = $1`,
      [id],
    );

    const {
      rows: [credit_note],
    } = await db.query(`SELECT * FROM credit_notes WHERE return_id = $1`, [id]);

    return { ...ret, items, credit_note: credit_note || null };
  },

  async create({ order_id, reason, notes, items }) {
    return db.withTransaction(async (client) => {
      const {
        rows: [order],
      } = await client.query(`SELECT * FROM orders WHERE id = $1`, [order_id]);

      if (!order) throw new Error("Order not found");
      if (!["shipped", "invoiced", "paid"].includes(order.status)) {
        throw new Error(
          `Cannot return an order with status: ${order.status}. Order must be shipped, invoiced, or paid.`,
        );
      }

      for (const item of items) {
        const {
          rows: [orderItem],
        } = await client.query(
          `SELECT * FROM order_items WHERE order_id = $1 AND product_id = $2`,
          [order_id, item.product_id],
        );

        if (!orderItem) {
          throw new Error(
            `Product ID ${item.product_id} was not part of this order`,
          );
        }

        if (item.quantity > orderItem.quantity) {
          throw new Error(
            `Cannot return more than ordered. Ordered: ${orderItem.quantity}, Returning: ${item.quantity}`,
          );
        }
      }

      const {
        rows: [ret],
      } = await client.query(
        `INSERT INTO returns (order_id, reason, notes) VALUES ($1, $2, $3) RETURNING *`,
        [order_id, reason, notes],
      );

      for (const item of items) {
        await client.query(
          `INSERT INTO return_items (return_id, product_id, quantity) VALUES ($1, $2, $3)`,
          [ret.id, item.product_id, item.quantity],
        );
      }

      const { rows: returnItems } = await client.query(
        `SELECT ri.*, p.name AS product_name, p.sku, p.unit_price
   FROM return_items ri
   JOIN products p ON p.id = ri.product_id
   WHERE ri.return_id = $1`,
        [ret.id],
      );

      return { ...ret, items: returnItems, credit_note: null };
    });
  },

  async approve(id) {
    const {
      rows: [ret],
    } = await db.query(`SELECT * FROM returns WHERE id = $1`, [id]);
    if (!ret) throw new Error("Return not found");
    if (ret.status !== "requested")
      throw new Error(`Cannot approve a return with status: ${ret.status}`);

    const {
      rows: [updated],
    } = await db.query(
      `UPDATE returns SET status='approved', updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id],
    );
    return updated;
  },

  async reject(id, notes) {
    const {
      rows: [ret],
    } = await db.query(`SELECT * FROM returns WHERE id = $1`, [id]);
    if (!ret) throw new Error("Return not found");
    if (ret.status !== "requested")
      throw new Error(`Cannot reject a return with status: ${ret.status}`);

    const {
      rows: [updated],
    } = await db.query(
      `UPDATE returns SET status='rejected', notes=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [notes, id],
    );
    return updated;
  },

  async restock(id) {
    return db.withTransaction(async (client) => {
      const {
        rows: [ret],
      } = await client.query(`SELECT * FROM returns WHERE id=$1 FOR UPDATE`, [
        id,
      ]);

      if (!ret) throw new Error("Return not found");
      if (ret.status !== "approved") {
        throw new Error(
          `Cannot restock a return with status: ${ret.status}. Must be approved first.`,
        );
      }

      const { rows: items } = await client.query(
        `SELECT ri.*, p.unit_price
         FROM return_items ri
         JOIN products p ON p.id = ri.product_id
         WHERE ri.return_id = $1`,
        [id],
      );

      let credit_amount = 0;

      for (const item of items) {
        await client.query(
          `UPDATE inventory SET qty_on_hand = qty_on_hand + $1, updated_at = NOW() WHERE product_id = $2`,
          [item.quantity, item.product_id],
        );

        await client.query(
          `INSERT INTO inventory_adjustments (product_id, delta, reason) VALUES ($1, $2, $3)`,
          [item.product_id, item.quantity, `Returned on Return #${id}`],
        );

        credit_amount += parseFloat(item.unit_price) * item.quantity;
      }

      const credit_note_number = generateCreditNoteNumber();
      await client.query(
        `INSERT INTO credit_notes (return_id, credit_note_number, amount) VALUES ($1, $2, $3)`,
        [id, credit_note_number, credit_amount.toFixed(2)],
      );

      const {
        rows: [updated],
      } = await client.query(
        `UPDATE returns SET status='restocked', updated_at=NOW() WHERE id=$1 RETURNING *`,
        [id],
      );

      return { ...updated, credit_amount, credit_note_number };
    });
  },

  async refund(id) {
    return db.withTransaction(async (client) => {
      const {
        rows: [ret],
      } = await client.query(`SELECT * FROM returns WHERE id=$1 FOR UPDATE`, [
        id,
      ]);

      if (!ret) throw new Error("Return not found");
      if (ret.status !== "restocked") {
        throw new Error(
          `Cannot refund a return with status: ${ret.status}. Must be restocked first.`,
        );
      }

      await client.query(
        `UPDATE credit_notes SET status='refunded', updated_at=NOW() WHERE return_id=$1`,
        [id],
      );

      const {
        rows: [updated],
      } = await client.query(
        `UPDATE returns SET status='refunded', updated_at=NOW() WHERE id=$1 RETURNING *`,
        [id],
      );

      return updated;
    });
  },
};

module.exports = ReturnModel;
