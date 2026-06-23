const express = require('express');
const router = express.Router();
const sectionController = require('../controllers/sectionController');
const verificarToken = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/roleMiddleware');

const esAdmin = verificarRol(['ADMIN', 'ADMINISTRADOR']);

// Rutas protegidas para administración de secciones
router.get('/', verificarToken, sectionController.getAllSections);
router.post('/', verificarToken, esAdmin, sectionController.createSection);
router.put('/:id', verificarToken, esAdmin, sectionController.updateSection);
router.delete('/:id', verificarToken, esAdmin, sectionController.deleteSection);

module.exports = router;