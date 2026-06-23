const express = require('express');
const cors = require('cors'); 

// Diagnóstico preliminar de importaciones
console.log("🔍 [DIAGNÓSTICO] Verificando carga de archivos de rutas...");
const authRoutes = require('./routes/authRoutes');
const academicRoutes = require('./routes/academicRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const gradeRoutes = require('./routes/gradeRoutes');
const adminRoutes = require('./routes/adminRoutes');
const periodRoutes = require('./routes/periodRoutes');
const courseRoutes = require('./routes/courseRoutes');
const sectionRoutes = require('./routes/sectionRoutes');

require('dotenv').config();

const app = express();

// Middlewares
app.use(cors()); 
app.use(express.json()); 

// Rutas del Microservicio
app.use('/api/auth', authRoutes);
app.use('/api/academico', academicRoutes);
app.use('/api/matricula', enrollmentRoutes);
app.use('/api/evaluaciones', gradeRoutes);
app.use('/api/usuarios', adminRoutes)
app.use('/api/periodos', periodRoutes);
app.use('/api/cursos', courseRoutes);
app.use('/api/secciones', sectionRoutes);

// =======================================================
// MAPEADOR DIRECTO POR ARCHIVOS DE RUTAS (INMUNE A ENCAPSULAMIENTO)
// =======================================================
const mapearRutasDesdeRouters = (configuracionRutas) => {
    const rtasFinales = [];

    // Iteramos sobre cada prefijo y su router correspondiente
    Object.entries(configuracionRutas).forEach(([prefijo, routerObjeto]) => {
        const stackInterno = routerObjeto.stack || (routerObjeto._router && routerObjeto._router.stack);
        
        if (stackInterno && Array.isArray(stackInterno)) {
            stackInterno.forEach((layer) => {
                if (layer.route) {
                    const metodos = Object.keys(layer.route.methods).join(', ').toUpperCase();
                    // Combinamos el prefijo base del app.use con la sub-ruta interna
                    const rutaCompleta = `${prefijo}/${layer.route.path}`.replace(/\/+/g, '/');
                    rtasFinales.push({
                        Metodo: metodos,
                        Ruta: rutaCompleta
                    });
                }
            });
        }
    });

    console.log("\n====== 🗺️  MAPA REAL DE ENDPOINTS ACTIVOS ======");
    if (rtasFinales.length === 0) {
        console.log("⚠️  No se pudieron mapear las rutas de forma automatizada por restricciones del entorno.");
    } else {
        console.table(rtasFinales);
    }
};

// Puerto de escucha
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`\n🚀 Microservicio de Autenticación corriendo en el puerto ${PORT}\n`);
    
    // Le pasamos directamente los routers que importaste con sus prefijos exactos
    mapearRutasDesdeRouters({
        '/api/auth': authRoutes,
        '/api/academico': academicRoutes,
        '/api/matricula': enrollmentRoutes,
        '/api/evaluaciones': gradeRoutes,
        '/api/usuarios': adminRoutes,
        '/api/periodos': periodRoutes,
        '/api/cursos': courseRoutes,
        '/api/secciones': sectionRoutes
    });
});
