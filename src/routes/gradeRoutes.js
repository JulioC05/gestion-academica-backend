const express = require('express');
const router = express.Router();
const gradeController = require('../controllers/gradeController');
const verificarToken = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/roleMiddleware');

// 🌟 Rutas protegidas y adaptadas a JWT
router.get('/profesor/mis-secciones', verificarToken, verificarRol(['ADMIN', 'ADMINISTRADOR', 'PROFESOR']), gradeController.getTeacherSections);
router.get('/profesor/secciones/:id/alumnos', verificarToken, verificarRol(['ADMIN', 'ADMINISTRADOR', 'PROFESOR']), gradeController.getSectionStudents);
router.post('/registrar', verificarToken, verificarRol(['ADMIN', 'ADMINISTRADOR', 'PROFESOR']), gradeController.createEvaluation); 
router.post('/calificaciones/registrar', verificarToken, verificarRol(['ADMIN', 'ADMINISTRADOR', 'PROFESOR']), gradeController.registerGrade); 

module.exports = router;