const router = require("express").Router();
const ReportsController = require("../controllers/reports.controller");
const { authorize } = require("../middleware/auth.middleware");

// Require admin for reports
router.use(authorize("admin"));

router.get("/revenue", ReportsController.revenueSummary);
router.get("/orders-summary", ReportsController.ordersSummary);
router.get("/top-products", ReportsController.topProducts);
router.get("/inventory-status", ReportsController.inventoryStatus);
router.get("/payments-summary", ReportsController.paymentsSummary);

module.exports = router;
