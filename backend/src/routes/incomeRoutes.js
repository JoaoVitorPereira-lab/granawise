const express = require('express');
const incomeController = require('../controllers/incomeController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware); // todas as rotas deste arquivo exigem login

router.get('/', incomeController.obter);
router.post('/', incomeController.definir);

module.exports = router;