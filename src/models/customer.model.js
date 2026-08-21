const db = require('../db');
const { paginate } = require('../utils/paginate');

const CustomerModel = {
  async findAll(tenant_id, { page, limit, search } = {}) {
    const conditions = ['tenant_id = $1'];
    const params = [tenant_id];

    if (search) {
      params.push('%' + search + '%');
      conditions.push('(name ILIKE $' + params.length + ' OR email ILIKE $' + params.length + ')');
    }

    const where = 'WHERE ' + conditions.join(' AND ');
    const baseQuery = 'SELECT * FROM customers ' + where + ' ORDER BY id';

    return paginate(db, baseQuery, params, { page, limit });
  },

  async findById(tenant_id, id) {
    const { rows } = await db.query(
      'SELECT * FROM customers WHERE id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );
    return rows[0] || null;
  },

  async findByEmail(tenant_id, email) {
    const { rows } = await db.query(
      'SELECT * FROM customers WHERE email = $1 AND tenant_id = $2',
      [email, tenant_id]
    );
    return rows[0] || null;
  },

  async create(tenant_id, { name, email, phone, address }) {
    const { rows } = await db.query(
      'INSERT INTO customers (tenant_id, name, email, phone, address) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [tenant_id, name, email, phone, address]
    );
    return rows[0];
  },

  async update(tenant_id, id, { name, phone, address }) {
    const { rows } = await db.query(
      'UPDATE customers SET name=$1, phone=$2, address=$3, updated_at=NOW() WHERE id=$4 AND tenant_id=$5 RETURNING *',
      [name, phone, address, id, tenant_id]
    );
    return rows[0] || null;
  },
};

module.exports = CustomerModel;
