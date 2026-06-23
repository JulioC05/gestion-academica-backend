const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verificarToken = require('../middlewares/authMiddleware');

// Ruta que consumirá el Frontend: POST http://localhost:3001/api/auth/login
router.post('/login', authController.login);
// router.post('/register', authController.register); 
router.get('/perfil', verificarToken, authController.getUserProfile);

module.exports = router;