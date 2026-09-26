const express = require("express");
const router = express.Router();
const { getAuditLogs } = require("../controllers/audit.controller");
const { authorize } = require("../middleware/auth.middleware");

// Require admin for audit logs
router.get("/", authorize("admin"), getAuditLogs);

module.exports = router;
