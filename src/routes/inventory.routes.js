const router = require("express").Router();
const { body } = require("express-validator");
const InventoryController = require("../Controllers/inventory.controller");

const adjustRules = [
  body("delta")
    .isInt()
    .withMessage(
      "delta must be an integer (positive to add, negative to remove)",
    ),
  body("reason").optional().trim().notEmpty(),
];

const reorderRules = [
  body("reorder_point")
    .isInt({ min: 0 })
    .withMessage("reorder_point must be a non-negative integer"),
];

router.get("/", InventoryController.getAll);
router.get("/low-stock", InventoryController.getLowStock);
router.post("/:product_id/adjust", adjustRules, InventoryController.adjust);
router.get("/:product_id/history", InventoryController.getHistory);
router.patch(
  "/:product_id/reorder-point",
  reorderRules,
  InventoryController.updateReorderPoint,
);

module.exports = router;
