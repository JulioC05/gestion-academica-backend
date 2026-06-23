const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollmentController');
const verificarToken = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/roleMiddleware');

// Endpoint: POST http://localhost:3001/api/matricula/registrar
router.post('/registrar', verificarToken, verificarRol(['ADMIN', 'ADMINISTRADOR', 'ALUMNO']), enrollmentController.processEnrollment);
router.get('/mis-cursos', verificarToken, verificarRol(['ADMIN', 'ADMINISTRADOR', 'ALUMNO']), enrollmentController.getMyCourses);
router.post('/retirar', verificarToken, verificarRol(['ADMIN', 'ADMINISTRADOR', 'ALUMNO']), enrollmentController.dropSection);

module.exports = router;