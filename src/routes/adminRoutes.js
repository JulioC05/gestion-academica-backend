const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const verificarToken = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/roleMiddleware');

// El endpoint queda protegido: Requiere sesión activa y rol ADMIN o ADMINISTRADOR
router.post('/admin/crear', verificarToken, verificarRol(['ADMIN', 'ADMINISTRADOR']), adminController.createUserEntity);

module.exports = router;