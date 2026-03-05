const router = require("express").Router();
const { body } = require("express-validator");
const CustomerController = require("../controllers/customer.controller");

const createRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("phone").optional().trim(),
  body("address").optional().trim(),
];

const updateRules = [
  body("name").optional().trim().notEmpty(),
  body("phone").optional().trim(),
  body("address").optional().trim(),
];

router.get("/", CustomerController.getAll);
router.get("/:id", CustomerController.getOne);
router.post("/", createRules, CustomerController.create);
router.patch("/:id", updateRules, CustomerController.update);

module.exports = router;
