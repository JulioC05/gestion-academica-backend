const express = require('express');
const router = express.Router();
const periodController = require('../controllers/periodController');
const verificarToken = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/roleMiddleware');

const esAdmin = verificarRol(['ADMIN', 'ADMINISTRADOR']);

// Rutas mapeadas
router.get('/', verificarToken, periodController.getAllPeriods);
router.post('/', verificarToken, esAdmin, periodController.createPeriod);
router.put('/:id', verificarToken, esAdmin, periodController.updatePeriod);
router.delete('/:id', verificarToken, esAdmin, periodController.deletePeriod);

module.exports = router;