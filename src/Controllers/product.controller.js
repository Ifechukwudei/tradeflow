const { validationResult } = require('express-validator');
const ProductModel = require('../models/product.model');

const ProductController = {
  async getAll(req, res) {
    try {
      const products = await ProductModel.findAll();
      res.json({ data: products });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getOne(req, res) {
    try {
      const product = await ProductModel.findById(req.params.id);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json({ data: product });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const product = await ProductModel.create(req.body);
      res.status(201).json({ data: product });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'SKU already exists' });
      res.status(500).json({ error: err.message });
    }
  },

  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const product = await ProductModel.update(req.params.id, req.body);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json({ data: product });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async delete(req, res) {
    try {
      const product = await ProductModel.delete(req.params.id);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json({ message: 'Product deleted', data: product });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = ProductController;
