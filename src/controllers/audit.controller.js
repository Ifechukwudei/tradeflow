const db = require("../db");

const getAuditLogs = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const { rows } = await db.query(
      "SELECT * FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC",
      [tenantId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const insertAuditLog = async (tenantId, userId, action, entity, entityId, changes) => {
  try {
    await db.query(
      "INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, changes) VALUES ($1, $2, $3, $4, $5, $6)",
      [tenantId, userId, action, entity, entityId, JSON.stringify(changes)]
    );
  } catch (err) {
    console.error("Failed to insert audit log", err);
  }
};

module.exports = { getAuditLogs, insertAuditLog };
