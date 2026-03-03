const db = require('../db');

const CustomerModel = {
  async findAll() {
    const { rows } = await db.query(
      `SELECT * FROM customers ORDER BY id`
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await db.query(
      `SELECT * FROM customers WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByEmail(email) {
    const { rows } = await db.query(
      `SELECT * FROM customers WHERE email = $1`,
      [email]
    );
    return rows[0] || null;
  },

  async create({ name, email, phone, address }) {
    const { rows } = await db.query(
      `INSERT INTO customers (name, email, phone, address)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, email, phone, address]
    );
    return rows[0];
  },

  async update(id, { name, phone, address }) {
    const { rows } = await db.query(
      `UPDATE customers
       SET name=$1, phone=$2, address=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [name, phone, address, id]
    );
    return rows[0] || null;
  },
};

module.exports = CustomerModel;
