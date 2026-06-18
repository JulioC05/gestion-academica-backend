const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // 🌟 CAMBIO CLAVE: Ahora leerá tu .env de forma dinámica
    server: process.env.DB_SERVER || '127.0.0.1', 
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT) || 1433, // Opcional: también dinámico
    options: {
        encrypt: false,  
        trustServerCertificate: true,
        enableArithAbort: true
    },
    connectionTimeout: 5000 
};

const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log('✅ Conectado exitosamente a SQL Server Local con SQL Login');
        return pool;
    })
    .catch(err => {
        console.error('❌ Error de conexión a la Base de Datos:', err.message);
        console.log('💡 Tip rápido: Si sigue dando timeout, nos falta verificar un pequeño check en el Configuration Manager.');
    });

module.exports = { sql, poolPromise };