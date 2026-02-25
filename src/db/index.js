const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false,
});

pool.on("error", (err) => {
  console.error("Unexpected DB client error", err);
  process.exit(-1);
});

/**
 * Run a single query
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a client for transactions
 */
const getClient = () => pool.connect();

/**
 * Helper to run logic inside a transaction.
 * Automatically commits or rolls back.
 */
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { query, getClient, withTransaction };
