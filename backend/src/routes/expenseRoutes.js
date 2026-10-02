const express = require('express');
const expenseController = require('../controllers/expenseController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

router.get('/', expenseController.listar);
router.post('/', expenseController.criar);
router.put('/:id', expenseController.atualizar);
router.delete('/:id', expenseController.remover);

module.exports = router;