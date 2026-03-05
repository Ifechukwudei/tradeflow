const router = require("express").Router();
const ReportsController = require("../controllers/reports.controller");

router.get("/revenue", ReportsController.revenueSummary);
router.get("/orders-summary", ReportsController.ordersSummary);
router.get("/top-products", ReportsController.topProducts);
router.get("/inventory-status", ReportsController.inventoryStatus);
router.get("/payments-summary", ReportsController.paymentsSummary);

module.exports = router;
