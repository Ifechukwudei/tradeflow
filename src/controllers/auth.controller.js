const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const UserModel = require('../models/user.model');

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const AuthController = {
  async register(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const user = await UserModel.create(req.body);
      const token = generateToken(user.id);
      res.status(201).json({ data: { user, token } });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
      res.status(500).json({ error: err.message });
    }
  },
  async login(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { email, password } = req.body;

      const user = await UserModel.findByEmail(email);
      if (!user) return res.status(401).json({ error: 'Invalid email or password' });

      const valid = await UserModel.verifyPassword(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

      if (!user.is_active) return res.status(401).json({ error: 'Account is deactivated' });

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      const { password_hash, ...safeUser } = user;
      // Return both user and token for cross-domain deployment
      res.json({ data: { user: safeUser, token } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async logout(req, res) {
    res.clearCookie('tf_token');
    res.json({ message: 'Logged out' });
  },

  async me(req, res) {
    res.json({ data: req.user });
  },

  async listUsers(req, res) {
    try {
      const users = await UserModel.findAll();
      res.json({ data: users });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateRole(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const user = await UserModel.updateRole(req.params.id, req.body.role);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ data: user });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async deactivate(req, res) {
    try {
      const user = await UserModel.deactivate(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ data: user });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = AuthController;
