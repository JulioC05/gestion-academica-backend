const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Ruta que consumirá el Frontend: POST http://localhost:3001/api/auth/login
router.post('/login', authController.login);

module.exports = router;