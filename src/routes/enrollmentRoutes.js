const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollmentController');

// Endpoint: POST http://localhost:3001/api/matricula/procesar
router.post('/procesar', enrollmentController.processEnrollment);

module.exports = router;