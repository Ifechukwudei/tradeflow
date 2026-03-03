const router = require("express").Router();
const { body } = require("express-validator");
const AuthController = require("../Controllers/auth.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");

const registerRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
  body("role")
    .optional()
    .isIn(["admin", "staff", "viewer"])
    .withMessage("Invalid role"),
];

const loginRules = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

const roleRules = [
  body("role").isIn(["admin", "staff", "viewer"]).withMessage("Invalid role"),
];

// Public routes
router.post("/register", registerRules, AuthController.register);
router.post("/login", loginRules, AuthController.login);

// Protected routes
router.get("/me", authenticate, AuthController.me);
router.get(
  "/users",
  authenticate,
  authorize("admin"),
  AuthController.listUsers,
);
router.patch(
  "/users/:id/role",
  authenticate,
  authorize("admin"),
  roleRules,
  AuthController.updateRole,
);

module.exports = router;
