const { validationResult } = require('express-validator');
const OrderModel = require('../models/order.model');

const OrderController = {
  async getAll(req, res) {
    try {
      const orders = await OrderModel.findAll();
      res.json({ data: orders });
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
