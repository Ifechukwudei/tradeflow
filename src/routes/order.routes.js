const router = require('express').Router();
const { body } = require('express-validator');
const OrderController = require('../controllers/order.controller');

const createRules = [
  body('customer_id').isInt({ min: 1 }).withMessage('Valid customer_id is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product_id').isInt({ min: 1 }).withMessage('Each item must have a valid product_id'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Each item quantity must be at least 1'),
  body('notes').optional().trim(),
];

router.get('/', OrderController.getAll);
router.get('/:id', OrderController.getOne);
router.post('/', createRules, OrderController.create);
router.patch('/:id/confirm', OrderController.confirm);
router.patch('/:id/ship', OrderController.ship);
router.patch('/:id/invoice', OrderController.invoice);
router.patch('/:id/cancel', OrderController.cancel);

module.exports = router;
