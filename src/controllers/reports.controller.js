const ReportsModel = require('../models/reports.model');

const ReportsController = {
  async revenueSummary(req, res) {
    try {
      const data = await ReportsModel.revenueSummary(req.user.tenant_id, req.query);
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async ordersSummary(req, res) {
    try {
      const data = await ReportsModel.ordersSummary(req.user.tenant_id);
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async topProducts(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const data = await ReportsModel.topProducts(req.user.tenant_id, { limit });
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async inventoryStatus(req, res) {
    try {
      const data = await ReportsModel.inventoryStatus(req.user.tenant_id);
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async paymentsSummary(req, res) {
    try {
      const data = await ReportsModel.paymentsSummary(req.user.tenant_id);
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = ReportsController;
