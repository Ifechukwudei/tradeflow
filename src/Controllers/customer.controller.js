const { validationResult } = require('express-validator');
const CustomerModel = require('../models/customer.model');

const CustomerController = {
  async getAll(req, res) {
    try {
      const customers = await CustomerModel.findAll();
      res.json({ data: customers });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getOne(req, res) {
    try {
      const customer = await CustomerModel.findById(req.params.id);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      res.json({ data: customer });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const customer = await CustomerModel.create(req.body);
      res.status(201).json({ data: customer });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
      res.status(500).json({ error: err.message });
    }
  },

  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const customer = await CustomerModel.update(req.params.id, req.body);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      res.json({ data: customer });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = CustomerController;
