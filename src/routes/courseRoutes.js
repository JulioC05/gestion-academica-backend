const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const verificarToken = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/roleMiddleware');

const esAdmin = verificarRol(['ADMIN', 'ADMINISTRADOR']);

// Rutas del catálogo de cursos
router.get('/', verificarToken, courseController.getAllCourses);
router.post('/', verificarToken, esAdmin, courseController.createCourse);
router.put('/:id', verificarToken, esAdmin, courseController.updateCourse);
router.delete('/:id', verificarToken, esAdmin, courseController.deleteCourse);

module.exports = router;