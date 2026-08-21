const db = require('../db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const UserModel = {
  async registerTenant({ company_name, name, email, password }) {
    return db.withTransaction(async (client) => {
      const { rows: [tenant] } = await client.query(
        `INSERT INTO tenants (company_name) VALUES ($1) RETURNING *`,
        [company_name]
      );
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
      const { rows: [user] } = await client.query(
        `INSERT INTO users (tenant_id, name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, 'admin')
         RETURNING id, tenant_id, name, email, role, is_active, created_at`,
        [tenant.id, name, email, password_hash]
      );
      return { tenant, user };
    });
  },

  async findById(tenant_id, id) {
    const { rows: [user] } = await db.query(
      `SELECT id, tenant_id, name, email, role, is_active, created_at FROM users WHERE id = $1 AND tenant_id = $2`,
      [id, tenant_id]
    );
    return user || null;
  },

  async findByEmail(email) {
    const { rows: [user] } = await db.query(
      `SELECT id, tenant_id, name, email, password_hash, role, is_active, created_at FROM users WHERE email = $1`,
      [email]
    );
    return user || null;
  },

  async create({ tenant_id, name, email, password, role = 'staff' }) {
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const { rows: [user] } = await db.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tenant_id, name, email, role, is_active, created_at`,
      [tenant_id, name, email, password_hash, role]
    );
    return user;
  },

  async verifyPassword(plainPassword, passwordHash) {
    return bcrypt.compare(plainPassword, passwordHash);
  },

  async findAll(tenant_id) {
    const { rows } = await db.query(
      `SELECT id, tenant_id, name, email, role, is_active, created_at FROM users WHERE tenant_id = $1 ORDER BY id`,
      [tenant_id]
    );
    return rows;
  },

  async updateRole(tenant_id, id, role) {
    const { rows: [user] } = await db.query(
      `UPDATE users SET role=$1, updated_at=NOW()
       WHERE id=$2 AND tenant_id=$3
       RETURNING id, tenant_id, name, email, role, is_active`,
      [role, id, tenant_id]
    );
    return user || null;
  },

  async deactivate(tenant_id, id) {
    const { rows: [user] } = await db.query(
      `UPDATE users SET is_active=false, updated_at=NOW()
       WHERE id=$1 AND tenant_id=$2
       RETURNING id, tenant_id, name, email, role, is_active`,
      [id, tenant_id]
    );
    return user || null;
  },
};

module.exports = UserModel;
