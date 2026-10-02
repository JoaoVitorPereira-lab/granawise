const express = require('express');
const categoryController = require('../controllers/categoryController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

router.get('/', categoryController.listar);
router.post('/', categoryController.criar);
router.post('/defaults', categoryController.criarPadrao);
router.put('/:id', categoryController.atualizar);
router.delete('/:id', categoryController.remover);

module.exports = router;