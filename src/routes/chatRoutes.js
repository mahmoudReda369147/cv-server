const express = require('express');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const chatController = require('../controllers/chatController');


const router = express.Router();

router.post('/', authMiddleware, chatController.createMessage)
router.get("/",authMiddleware,chatController.getAllChates)
router.get("/pdfs", authMiddleware, chatController.getPdfsByUser)
router.get("/:id",authMiddleware,chatController.getAllMessages)
module.exports = router;