const ReportsModel = require('../models/reports.model');

const ReportsController = {
  async revenueSummary(req, res) {
    try {
      const { from, to } = req.query;
      const data = await ReportsModel.revenueSummary({ from, to });
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async ordersSummary(req, res) {
    try {
      const data = await ReportsModel.ordersSummary();
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async topProducts(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const data = await ReportsModel.topProducts({ limit });
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async inventoryStatus(req, res) {
    try {
      const data = await ReportsModel.inventoryStatus();
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async paymentsSummary(req, res) {
    try {
      const data = await ReportsModel.paymentsSummary();
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = ReportsController;
