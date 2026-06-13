const { sql, poolPromise } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    const { correo, contrasena } = req.body;

    // Validación básica de entrada
    if (!correo || !contrasena) {
        return res.status(400).json({ message: 'Correo y contraseña son requeridos' });
    }

    try {
        const pool = await poolPromise;
        
        // Buscamos al usuario y jalamos su rol en una sola consulta (JOIN)
        const result = await pool.request()
            .input('correo', sql.VarChar, correo)
            .query(`
                SELECT u.id, u.correo, u.contrasena, u.activo, r.nombre as rol 
                FROM usuarios u
                INNER JOIN roles r ON u.rol_id = r.id
                WHERE u.correo = @correo
            `);

        const usuario = result.recordset[0];

        // Si el usuario no existe o está inactivo
        if (!usuario || !usuario.activo) {
            return res.status(401).json({ message: 'Credenciales incorrectas o usuario inactivo' });
        }

        // Verificar contraseña (compara el texto plano con el hash encriptado de la BD)
        const passwordCorrecto = await bcrypt.compare(contrasena, usuario.contrasena);
        if (!passwordCorrecto) {
            return res.status(401).json({ message: 'Credenciales incorrectas' });
        }

        // Generar el Token JWT firmado
        const token = jwt.sign(
            { id: usuario.id, correo: usuario.correo, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: '4h' } // El token expira en 4 horas
        );

        // Responder al frontend con el token y los datos del usuario
        res.json({
            message: 'Login exitoso',
            token,
            usuario: {
                id: usuario.id,
                correo: usuario.correo,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error('Error en el proceso de Login:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};