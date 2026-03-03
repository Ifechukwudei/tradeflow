const db = require('../db');

// Auto-generate invoice numbers like INV-20260302-001
const generateInvoiceNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${date}-${random}`;
};

const InvoiceModel = {
  async findAll() {
    const { rows } = await db.query(
      `SELECT i.*, o.total_amount, c.name AS customer_name
       FROM invoices i
       JOIN orders o ON o.id = i.order_id
       JOIN customers c ON c.id = o.customer_id
       ORDER BY i.id DESC`
    );
    return rows;
  },

  async findById(id) {
    const { rows: [invoice] } = await db.query(
      `SELECT i.*, c.name AS customer_name, c.email AS customer_email
       FROM invoices i
       JOIN orders o ON o.id = i.order_id
       JOIN customers c ON c.id = o.customer_id
       WHERE i.id = $1`,
      [id]
    );

    if (!invoice) return null;

    const { rows: payments } = await db.query(
      `SELECT * FROM payments WHERE invoice_id = $1 ORDER BY paid_at ASC`,
      [id]
    );

    return { ...invoice, payments };
  },

  async findByOrderId(order_id) {
    const { rows: [invoice] } = await db.query(
      `SELECT * FROM invoices WHERE order_id = $1`,
      [order_id]
    );
    return invoice || null;
  },

  async create(order_id, due_days = 30) {
    const { rows: [order] } = await db.query(
      `SELECT * FROM orders WHERE id = $1`,
      [order_id]
    );

    if (!order) throw new Error('Order not found');
    if (order.status !== 'shipped') throw new Error('Order must be shipped before invoicing');

    const invoice_number = generateInvoiceNumber();

    const { rows: [invoice] } = await db.query(
      `INSERT INTO invoices (order_id, invoice_number, amount_due, due_date)
       VALUES ($1, $2, $3, NOW() + INTERVAL '${due_days} days')
       RETURNING *`,
      [order_id, invoice_number, order.total_amount]
    );

    await db.query(
      `UPDATE orders SET status='invoiced', updated_at=NOW() WHERE id=$1`,
      [order_id]
    );

    return invoice;
  },

  async recordPayment(invoice_id, { amount, payment_method, reference, notes }) {
    return db.withTransaction(async (client) => {
      const { rows: [invoice] } = await client.query(
        `SELECT * FROM invoices WHERE id=$1 FOR UPDATE`,
        [invoice_id]
      );

      if (!invoice) throw new Error('Invoice not found');
      if (invoice.status === 'paid') throw new Error('Invoice is already fully paid');

      const new_amount_paid = parseFloat(invoice.amount_paid) + parseFloat(amount);

      if (new_amount_paid > parseFloat(invoice.amount_due)) {
        throw new Error(
          `Payment of ${amount} exceeds remaining balance of ${(invoice.amount_due - invoice.amount_paid).toFixed(2)}`
        );
      }

      // Record the payment
      const { rows: [payment] } = await client.query(
        `INSERT INTO payments (invoice_id, amount, payment_method, reference, notes)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [invoice_id, amount, payment_method, reference, notes]
      );

      // Determine new invoice status
      const new_status = new_amount_paid >= parseFloat(invoice.amount_due) ? 'paid' : 'partial';

      // Update invoice
      await client.query(
        `UPDATE invoices
         SET amount_paid=$1, status=$2, updated_at=NOW()
         WHERE id=$3`,
        [new_amount_paid.toFixed(2), new_status, invoice_id]
      );

      // If fully paid, update order status
      if (new_status === 'paid') {
        await client.query(
          `UPDATE orders SET status='paid', updated_at=NOW() WHERE id=$1`,
          [invoice.order_id]
        );
      }

      return { ...payment, invoice_status: new_status, amount_paid: new_amount_paid };
    });
  },
};

module.exports = InvoiceModel;
