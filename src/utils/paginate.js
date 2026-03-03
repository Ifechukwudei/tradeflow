/**
 * Reusable pagination helper.
 *
 * @param {object} db - the db query function
 * @param {string} baseQuery - SQL query without LIMIT/OFFSET
 * @param {Array}  params    - query parameters for filters
 * @param {object} options   - { page, limit }
 *
 * @returns { data, pagination }
 */
const paginate = async (db, baseQuery, params = [], { page = 1, limit = 20 } = {}) => {
  page  = Math.max(1, parseInt(page)  || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20)); // cap at 100 per page

  const offset = (page - 1) * limit;

  // Count total matching rows
  const countQuery = `SELECT COUNT(*) AS total FROM (${baseQuery}) AS count_query`;
  const { rows: [{ total }] } = await db.query(countQuery, params);

  // Fetch the page
  const dataQuery = `${baseQuery} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const { rows: data } = await db.query(dataQuery, [...params, limit, offset]);

  const total_pages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      total:       parseInt(total),
      page,
      limit,
      total_pages,
      has_next:    page < total_pages,
      has_prev:    page > 1,
    },
  };
};

module.exports = { paginate };
