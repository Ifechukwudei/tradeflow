const router = require("express").Router();
const { body } = require("express-validator");
const ReturnController = require("../Controllers/return.controller");

const createRules = [
  body("order_id").isInt({ min: 1 }).withMessage("Valid order_id is required"),
  body("reason").trim().notEmpty().withMessage("Reason is required"),
  body("items")
    .isArray({ min: 1 })
    .withMessage("At least one item is required"),
  body("items.*.product_id")
    .isInt({ min: 1 })
    .withMessage("Each item needs a valid product_id"),
  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Each item quantity must be at least 1"),
  body("notes").optional().trim(),
];

router.get("/", ReturnController.getAll);
router.get("/:id", ReturnController.getOne);
router.post("/", createRules, ReturnController.create);
router.patch("/:id/approve", ReturnController.approve);
router.patch("/:id/reject", ReturnController.reject);
router.patch("/:id/restock", ReturnController.restock);
router.patch("/:id/refund", ReturnController.refund);

module.exports = router;
