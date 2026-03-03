const { validationResult } = require('express-validator');
const InvoiceModel = require('../models/invoice.model');

const InvoiceController = {
  async getAll(req, res) {
    try {
      const invoices = await InvoiceModel.findAll();
      res.json({ data: invoices });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getOne(req, res) {
    try {
      const invoice = await InvoiceModel.findById(req.params.id);
      if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
      res.json({ data: invoice });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async recordPayment(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const payment = await InvoiceModel.recordPayment(req.params.id, req.body);
      res.status(201).json({ data: payment });
    } catch (err) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      if (err.message.includes('already fully paid') || err.message.includes('exceeds')) {
        return res.status(422).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = InvoiceController;
