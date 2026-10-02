const express = require('express');
const chatbotController = require('../controllers/chatbotController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

router.get('/', chatbotController.menu);
router.get('/:option', chatbotController.responder);

module.exports = router;