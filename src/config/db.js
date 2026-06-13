const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true, // Obligatorio para Azure SQL
        trustServerCertificate: false 
    }
};

const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log('✅ Conectado exitosamente a Azure SQL Database');
        return pool;
    })
    .catch(err => {
        console.error('❌ Error de conexión a la Base de Datos:', err);
        process.exit(1);
    });

module.exports = { sql, poolPromise };