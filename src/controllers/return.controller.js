const { validationResult } = require("express-validator");
const ReturnModel = require("../models/return.model");

const ReturnController = {
  async getAll(req, res) {
    try {
      const result = await ReturnModel.findAll(req.user.tenant_id, req.query);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getOne(req, res) {
    try {
      const ret = await ReturnModel.findById(req.user.tenant_id, req.params.id);
      if (!ret) return res.status(404).json({ error: "Return not found" });
      res.json({ data: ret });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    try {
      const ret = await ReturnModel.create(req.user.tenant_id, req.body);
      res.status(201).json({ data: ret });
    } catch (err) {
      if (
        err.message.includes("Cannot return") ||
        err.message.includes("Cannot return more")
      )
        return res.status(422).json({ error: err.message });
      res.status(500).json({ error: err.message });
    }
  },

  async approve(req, res) {
    try {
      const ret = await ReturnModel.approve(req.user.tenant_id, req.params.id);
      res.json({ message: "Return approved", data: ret });
    } catch (err) {
      res.status(422).json({ error: err.message });
    }
  },

  async reject(req, res) {
    try {
      const ret = await ReturnModel.reject(req.user.tenant_id, req.params.id, req.body.notes);
      res.json({ message: "Return rejected", data: ret });
    } catch (err) {
      res.status(422).json({ error: err.message });
    }
  },

  async restock(req, res) {
    try {
      const ret = await ReturnModel.restock(req.user.tenant_id, req.params.id);
      res.json({
        message: "Items restocked and credit note generated",
        data: ret,
      });
    } catch (err) {
      res.status(422).json({ error: err.message });
    }
  },

  async refund(req, res) {
    try {
      const ret = await ReturnModel.refund(req.user.tenant_id, req.params.id);
      res.json({ message: "Refund recorded", data: ret });
    } catch (err) {
      res.status(422).json({ error: err.message });
    }
  },
};

module.exports = ReturnController;
