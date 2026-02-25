const router = require('express').Router();
const { body } = require('express-validator');
const ProductController = require('../Controllers/product.controller');

const createRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required'),
  body('unit_price').isFloat({ min: 0 }).withMessage('unit_price must be a non-negative number'),
  body('initial_stock').optional().isInt({ min: 0 }).withMessage('initial_stock must be a non-negative integer'),
  body('reorder_point').optional().isInt({ min: 0 }).withMessage('reorder_point must be a non-negative integer'),
];

const updateRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('unit_price').optional().isFloat({ min: 0 }).withMessage('unit_price must be a non-negative number'),
];

router.get('/', ProductController.getAll);
router.get('/:id', ProductController.getOne);
router.post('/', createRules, ProductController.create);
router.patch('/:id', updateRules, ProductController.update);
router.delete('/:id', ProductController.delete);

module.exports = router;
