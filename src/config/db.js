const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: '127.0.0.1', // Usamos la IP local directa en lugar de 'localhost'
    database: process.env.DB_DATABASE,
    port: 1433,          // Forzamos el puerto directo que habilitaste
    options: {
        encrypt: false,  // Desactivado para evitar demoras de certificados en local
        trustServerCertificate: true,
        enableArithAbort: true
    },
    connectionTimeout: 5000 // Si falla, que avise a los 5 segundos y no espere 15
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