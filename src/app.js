const express = require('express');
const cors = require('cors'); // Instálalo con `npm install cors` para permitir que el frontend de tu amigo se conecte
const authRoutes = require('./routes/authRoutes');
const academicRoutes = require('./routes/academicRoutes');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors()); // Permite peticiones cruzadas (de React a Node)
app.use(express.json()); // Permite procesar formato JSON en las peticiones

// Rutas del Microservicio
app.use('/api/auth', authRoutes);
app.use('/api/academico', academicRoutes);

// Puerto de escucha
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Microservicio de Autenticación corriendo en el puerto ${PORT}`);
});