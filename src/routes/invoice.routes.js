const router = require('express').Router();
const { body } = require('express-validator');
const InvoiceController = require('../controllers/invoice.controller');

const paymentRules = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('payment_method')
    .isIn(['bank_transfer', 'credit_card', 'cash', 'cheque'])
    .withMessage('Invalid payment method'),
  body('reference').optional().trim(),
  body('notes').optional().trim(),
];

router.get('/', InvoiceController.getAll);
router.get('/:id', InvoiceController.getOne);
router.post('/:id/payments', paymentRules, InvoiceController.recordPayment);

module.exports = router;
