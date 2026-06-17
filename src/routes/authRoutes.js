const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Ruta que consumirá el Frontend: POST http://localhost:3001/api/auth/login
router.post('/login', authController.login);
router.post('/register', authController.register); // <-- Agregar esta línea

module.exports = router;