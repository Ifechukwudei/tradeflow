const { validationResult } = require("express-validator");
const InventoryModel = require("../models/inventory.model");

const InventoryController = {
  async getAll(req, res) {
    try {
      const inventory = await InventoryModel.findAll();
      res.json({ data: inventory });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getLowStock(req, res) {
    try {
      const items = await InventoryModel.getLowStock();
      res.json({ data: items });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async adjust(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const { delta, reason } = req.body;
      const updated = await InventoryModel.adjust(
        req.params.product_id,
        delta,
        reason,
      );
      res.json({ message: "Stock adjusted", data: updated });
    } catch (err) {
      if (err.message.includes("Insufficient stock")) {
        return res.status(422).json({ error: err.message });
      }
      if (err.message.includes("not found")) {
        return res.status(404).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  },

  async getHistory(req, res) {
    try {
      const history = await InventoryModel.getAdjustmentHistory(
        req.params.product_id,
      );
      res.json({ data: history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateReorderPoint(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const updated = await InventoryModel.updateReorderPoint(
        req.params.product_id,
        req.body.reorder_point,
      );
      if (!updated)
        return res.status(404).json({ error: "Inventory record not found" });
      res.json({ data: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = InventoryController;
