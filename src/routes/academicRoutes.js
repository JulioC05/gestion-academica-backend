const express = require('express');
const router = express.Router();
const academicController = require('../controllers/academicController');

// Endpoint: GET http://localhost:3001/api/academico/catalogo
router.get('/catalogo', academicController.getAvailableCatalog);

module.exports = router;