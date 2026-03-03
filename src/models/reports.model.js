const db = require('../db');

const ReportsModel = {
  /**
   * Revenue summary — total revenue, orders, and average order value
   * Optionally filter by date range using ?from=2026-01-01&to=2026-12-31
   */
  async revenueSummary({ from, to } = {}) {
    const conditions = [`o.status IN ('invoiced', 'paid')`];
    const params = [];

    if (from) {
      params.push(from);
      conditions.push(`o.created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`o.created_at <= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows: [summary] } = await db.query(
      `SELECT
        COUNT(o.id)                          AS total_orders,
        COALESCE(SUM(o.total_amount), 0)     AS total_revenue,
        COALESCE(AVG(o.total_amount), 0)     AS avg_order_value,
        COALESCE(SUM(i.amount_paid), 0)      AS total_collected,
        COALESCE(SUM(i.amount_due - i.amount_paid), 0) AS total_outstanding
       FROM orders o
       LEFT JOIN invoices i ON i.order_id = o.id
       ${where}`,
      params
    );

    return summary;
  },

  /**
   * Order pipeline — count of orders grouped by status
   */
  async ordersSummary() {
    const { rows } = await db.query(
      `SELECT
        status,
        COUNT(*) AS count,
        SUM(total_amount) AS total_value
       FROM orders
       GROUP BY status
       ORDER BY
         CASE status
           WHEN 'pending'   THEN 1
           WHEN 'confirmed' THEN 2
           WHEN 'shipped'   THEN 3
           WHEN 'invoiced'  THEN 4
           WHEN 'paid'      THEN 5
           WHEN 'cancelled' THEN 6
         END`
    );
    return rows;
  },

  /**
   * Top selling products by units sold and revenue generated
   */
  async topProducts({ limit = 10 } = {}) {
    const { rows } = await db.query(
      `SELECT
        p.id,
        p.name,
        p.sku,
        COUNT(DISTINCT o.id)        AS total_orders,
        SUM(oi.quantity)            AS total_units_sold,
        SUM(oi.total_price)         AS total_revenue
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status NOT IN ('cancelled')
       GROUP BY p.id, p.name, p.sku
       ORDER BY total_revenue DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  },

  /**
   * Inventory status — stock levels with low stock flagging
   */
  async inventoryStatus() {
    const { rows } = await db.query(
      `SELECT
        p.id,
        p.name,
        p.sku,
        p.unit_price,
        i.qty_on_hand,
        i.qty_reserved,
        (i.qty_on_hand - i.qty_reserved)  AS qty_available,
        i.reorder_point,
        CASE
          WHEN (i.qty_on_hand - i.qty_reserved) = 0        THEN 'out_of_stock'
          WHEN (i.qty_on_hand - i.qty_reserved) <= i.reorder_point THEN 'low_stock'
          ELSE 'ok'
        END AS stock_status,
        -- Stock value = what the current inventory is worth
        (i.qty_on_hand * p.unit_price)    AS stock_value
       FROM inventory i
       JOIN products p ON p.id = i.product_id
       ORDER BY stock_status ASC, qty_available ASC`
    );
    return rows;
  },

  /**
   * Payments summary — invoiced vs collected vs outstanding
   */
  async paymentsSummary() {
    const { rows: [summary] } = await db.query(
      `SELECT
        COUNT(i.id)                              AS total_invoices,
        COALESCE(SUM(i.amount_due), 0)           AS total_invoiced,
        COALESCE(SUM(i.amount_paid), 0)          AS total_collected,
        COALESCE(SUM(i.amount_due - i.amount_paid), 0) AS total_outstanding,
        COUNT(*) FILTER (WHERE i.status = 'paid')    AS paid_invoices,
        COUNT(*) FILTER (WHERE i.status = 'partial') AS partial_invoices,
        COUNT(*) FILTER (WHERE i.status = 'unpaid')  AS unpaid_invoices,
        COUNT(*) FILTER (WHERE i.due_date < NOW() AND i.status != 'paid') AS overdue_invoices
       FROM invoices i`
    );
    return summary;
  },
};

module.exports = ReportsModel;
