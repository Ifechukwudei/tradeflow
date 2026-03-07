const { validationResult } = require('express-validator');
const OrderModel = require('../models/order.model');
const InvoiceModel = require('../models/invoice.model');

const OrderController = {
  async getAll(req, res) {
    try {
      const { page, limit, status, customer_id, from, to } = req.query;
      const result = await OrderModel.findAll({ page, limit, status, customer_id, from, to });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getOne(req, res) {
    try {
      const order = await OrderModel.findById(req.params.id);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.json({ data: order });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const order = await OrderModel.create(req.body);
      res.status(201).json({ data: order });
    } catch (err) {
      if (err.message.includes('Insufficient stock') || err.message.includes('not found')) {
        return res.status(422).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  },

  async confirm(req, res) {
    try {
      const order = await OrderModel.confirm(req.params.id);
      res.json({ message: 'Order confirmed', data: order });
    } catch (err) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      if (err.message.includes('Cannot confirm')) return res.status(422).json({ error: err.message });
      res.status(500).json({ error: err.message });
    }
  },

  async ship(req, res) {
    try {
      const order = await OrderModel.ship(req.params.id);
      res.json({ message: 'Order shipped', data: order });
    } catch (err) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      if (err.message.includes('Cannot ship')) return res.status(422).json({ error: err.message });
      res.status(500).json({ error: err.message });
    }
  },

  async invoice(req, res) {
    try {
      const due_days = req.body.due_days || 30;
      const invoice = await InvoiceModel.create(req.params.id, due_days);
      res.status(201).json({ message: 'Invoice generated', data: invoice });
    } catch (err) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      if (err.message.includes('must be shipped')) return res.status(422).json({ error: err.message });
      res.status(500).json({ error: err.message });
    }
  },

  async cancel(req, res) {
    try {
      const order = await OrderModel.cancel(req.params.id);
      res.json({ message: 'Order cancelled', data: order });
    } catch (err) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      if (err.message.includes('Cannot cancel')) return res.status(422).json({ error: err.message });
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = OrderController;
