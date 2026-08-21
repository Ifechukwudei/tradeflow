const db = require('../db');

// Auto-generate invoice numbers like INV-20260302-001
const generateInvoiceNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${date}-${random}`;
};

const InvoiceModel = {
  async findAll(tenant_id) {
    const { rows } = await db.query(
      `SELECT i.*, o.total_amount, c.name AS customer_name
       FROM invoices i
       JOIN orders o ON o.id = i.order_id AND o.tenant_id = i.tenant_id
       JOIN customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
       WHERE i.tenant_id = $1
       ORDER BY i.id DESC`,
      [tenant_id]
    );
    return rows;
  },

  async findById(tenant_id, id) {
    const { rows: [invoice] } = await db.query(
      `SELECT i.*, c.name AS customer_name, c.email AS customer_email
       FROM invoices i
       JOIN orders o ON o.id = i.order_id AND o.tenant_id = i.tenant_id
       JOIN customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
       WHERE i.id = $1 AND i.tenant_id = $2`,
      [id, tenant_id]
    );

    if (!invoice) return null;

    const { rows: payments } = await db.query(
      `SELECT * FROM payments WHERE invoice_id = $1 AND tenant_id = $2 ORDER BY paid_at ASC`,
      [id, tenant_id]
    );

    return { ...invoice, payments };
  },

  async findByOrderId(tenant_id, order_id) {
    const { rows: [invoice] } = await db.query(
      `SELECT * FROM invoices WHERE order_id = $1 AND tenant_id = $2`,
      [order_id, tenant_id]
    );
    return invoice || null;
  },

  async create(tenant_id, order_id, due_days = 30) {
    return db.withTransaction(async (client) => {
      const { rows: [order] } = await client.query(
        `SELECT * FROM orders WHERE id = $1 AND tenant_id = $2`,
        [order_id, tenant_id]
      );

      if (!order) throw new Error('Order not found');
      if (order.status !== 'shipped') throw new Error('Order must be shipped before invoicing');

      const invoice_number = generateInvoiceNumber();

      const { rows: [invoice] } = await client.query(
        `INSERT INTO invoices (tenant_id, order_id, invoice_number, amount_due, due_date)
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${parseInt(due_days, 10)} days')
         RETURNING *`,
        [tenant_id, order_id, invoice_number, order.total_amount]
      );

      await client.query(
        `UPDATE orders SET status='invoiced', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
        [order_id, tenant_id]
      );

      return invoice;
    });
  },

  async recordPayment(tenant_id, invoice_id, { amount, payment_method, reference, notes }) {
    return db.withTransaction(async (client) => {
      const { rows: [invoice] } = await client.query(
        `SELECT * FROM invoices WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
        [invoice_id, tenant_id]
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
        `INSERT INTO payments (tenant_id, invoice_id, amount, payment_method, reference, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [tenant_id, invoice_id, amount, payment_method, reference, notes]
      );

      // Determine new invoice status
      const new_status = new_amount_paid >= parseFloat(invoice.amount_due) ? 'paid' : 'partial';

      // Update invoice
      await client.query(
        `UPDATE invoices
         SET amount_paid=$1, status=$2, updated_at=NOW()
         WHERE id=$3 AND tenant_id=$4`,
        [new_amount_paid.toFixed(2), new_status, invoice_id, tenant_id]
      );

      // If fully paid, update order status
      if (new_status === 'paid') {
        await client.query(
          `UPDATE orders SET status='paid', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
          [invoice.order_id, tenant_id]
        );
      }

      return { ...payment, invoice_status: new_status, amount_paid: new_amount_paid };
    });
  },
};

module.exports = InvoiceModel;
