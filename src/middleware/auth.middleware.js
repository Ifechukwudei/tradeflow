const jwt = require('jsonwebtoken');
const UserModel = require('../models/user.model');

/**
 * Verifies the JWT token on every protected request.
 * Attaches the user object to req.user if valid.
 */
const authenticate = async (req, res, next) => {
  try {
    // Check cookie first, then fall back to Authorization header
    const token = req.cookies?.tf_token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided. Please log in.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token. Please log in.' });
  }
};

/**
 * Role-based access control.
 * Usage: authorize('admin') or authorize('admin', 'staff')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}.`
      });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
