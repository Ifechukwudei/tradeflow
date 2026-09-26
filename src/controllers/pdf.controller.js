const PDFDocument = require('pdfkit');
const db = require('../db');

const generateInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant_id = req.user.tenant_id;

    const { rows: [invoice] } = await db.query(
      "SELECT i.*, o.created_at as order_date, c.name as customer_name, c.email as customer_email, c.address as customer_address, t.company_name
       FROM invoices i
       JOIN orders o ON o.id = i.order_id
       JOIN customers c ON c.id = o.customer_id
       JOIN tenants t ON t.id = i.tenant_id
       WHERE i.id = $1 AND i.tenant_id = $2",
      [id, tenant_id]
    );

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const { rows: items } = await db.query(
      "SELECT oi.quantity, oi.unit_price, oi.total_price, p.name 
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1 AND oi.tenant_id = $2",
      [invoice.order_id, tenant_id]
    );

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-disposition', "attachment; filename="${invoice.invoice_number}.pdf"");
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(20).text(invoice.company_name, 50, 50);
    doc.fontSize(10).text("Invoice #: ${invoice.invoice_number}", 50, 80);
    doc.text("Date: ${new Date(invoice.created_at).toLocaleDateString()}", 50, 95);

    doc.fontSize(12).fillColor(invoice.status === 'paid' ? 'green' : 'red').text(invoice.status.toUpperCase(), 450, 50, { align: 'right' });
    doc.moveDown(3);
    doc.fillColor('black').fontSize(12).text('Bill To:', 50, 140);
    doc.fontSize(10).text(invoice.customer_name, 50, 160);
    doc.text(invoice.customer_email, 50, 175);
    if (invoice.customer_address) doc.text(invoice.customer_address, 50, 190);

    doc.moveDown(4);
    const tableTop = 250;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Item Description', 50, tableTop);
    doc.text('Qty', 300, tableTop);
    doc.text('Unit Price', 380, tableTop);
    doc.text('Total', 450, tableTop);
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    doc.font('Helvetica');
    let y = tableTop + 25;
    items.forEach(item => {
      doc.text(item.name, 50, y);
      doc.text(item.quantity.toString(), 300, y);
      doc.text("?${Number(item.unit_price).toFixed(2)}", 380, y);
      doc.text("?${Number(item.total_price).toFixed(2)}", 450, y);
      y += 20;
    });
    doc.moveTo(50, y + 10).lineTo(550, y + 10).stroke();

    doc.font('Helvetica-Bold');
    doc.text('Amount Due:', 350, y + 25);
    doc.text("?${Number(invoice.amount_due).toFixed(2)}", 450, y + 25);
    doc.text('Amount Paid:', 350, y + 45);
    doc.text("?${Number(invoice.amount_paid).toFixed(2)}", 450, y + 45);
    const remaining = Number(invoice.amount_due) - Number(invoice.amount_paid);
    doc.text('Balance:', 350, y + 65);
    doc.text("?${remaining.toFixed(2)}", 450, y + 65);

    doc.fontSize(10).font('Helvetica').text('Thank you for your business!', 50, 700, { align: 'center', width: 500 });
    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

module.exports = { generateInvoicePDF };
