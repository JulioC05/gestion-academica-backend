const express = require('express');
const router = express.Router();
const academicController = require('../controllers/academicController');
const verificarToken = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/roleMiddleware');

// Endpoint: GET http://localhost:3001/api/academico/catalogo
// router.get('/catalogo', academicController.getAvailableCatalog);
// router.get('/notas/:alumno_id', academicController.getStudentGrades);
router.get('/libreta', verificarToken, verificarRol(['ADMIN', 'ADMINISTRADOR', 'ALUMNO']), academicController.getReportCard);
router.post('/calificar', verificarToken, verificarRol(['ADMIN', 'ADMINISTRADOR', 'PROFESOR']), academicController.submitBulkGrades);

module.exports = router;