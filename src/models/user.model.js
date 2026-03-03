const db = require('../db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const UserModel = {
  async findById(id) {
    const { rows: [user] } = await db.query(
      `SELECT id, name, email, role, is_active, created_at FROM users WHERE id = $1`,
      [id]
    );
    return user || null;
  },

  async findByEmail(email) {
    const { rows: [user] } = await db.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );
    return user || null;
  },

  async create({ name, email, password, role = 'staff' }) {
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const { rows: [user] } = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, is_active, created_at`,
      [name, email, password_hash, role]
    );
    return user;
  },

  async verifyPassword(plainPassword, passwordHash) {
    return bcrypt.compare(plainPassword, passwordHash);
  },

  async findAll() {
    const { rows } = await db.query(
      `SELECT id, name, email, role, is_active, created_at FROM users ORDER BY id`
    );
    return rows;
  },

  async updateRole(id, role) {
    const { rows: [user] } = await db.query(
      `UPDATE users SET role=$1, updated_at=NOW()
       WHERE id=$2
       RETURNING id, name, email, role, is_active`,
      [role, id]
    );
    return user || null;
  },

  async deactivate(id) {
    const { rows: [user] } = await db.query(
      `UPDATE users SET is_active=false, updated_at=NOW()
       WHERE id=$1
       RETURNING id, name, email, role, is_active`,
      [id]
    );
    return user || null;
  },
};

module.exports = UserModel;
