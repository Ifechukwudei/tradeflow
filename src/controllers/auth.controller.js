const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const UserModel = require('../models/user.model');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const AuthController = {
  async register(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      let user;
      let tenant;

      if (req.body.company_name) {
        const result = await UserModel.registerTenant(req.body);
        user = result.user;
        tenant = result.tenant;
      } else {
        const tenant_id = req.user?.tenant_id || req.body.tenant_id;
        if (!tenant_id) {
          return res.status(400).json({ error: 'Tenant ID or company name is required' });
        }
        user = await UserModel.create({
          tenant_id,
          name: req.body.name,
          email: req.body.email,
          password: req.body.password,
          role: req.body.role,
        });
      }

      const token = generateToken(user);
      const { password_hash, ...safeUser } = user;
      res.status(201).json({
        data: {
          user: safeUser,
          token,
          ...(tenant && { tenant }),
        },
      });
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

      const token = generateToken(user);

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
      const users = await UserModel.findAll(req.user.tenant_id);
      res.json({ data: users });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateRole(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const user = await UserModel.updateRole(req.user.tenant_id, req.params.id, req.body.role);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ data: user });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async deactivate(req, res) {
    try {
      const user = await UserModel.deactivate(req.user.tenant_id, req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ data: user });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = AuthController;
