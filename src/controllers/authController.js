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

// Función temporal para registrar usuarios con contraseñas bien encriptadas
exports.register = async (req, res) => {
    const { correo, contrasena, rol_id } = req.body;

    if (!correo || !contrasena || !rol_id) {
        return res.status(400).json({ message: 'Todos los campos son requeridos' });
    }

    try {
        const pool = await poolPromise;

        // 1. Encriptar la contraseña usando Bcrypt de forma nativa
        const salt = await bcrypt.genSalt(10);
        const contrasenaEncriptada = await bcrypt.hash(contrasena, salt);

        // 2. Insertar en la base de datos
        await pool.request()
            .input('correo', sql.VarChar, correo)
            .input('contrasena', sql.VarChar, contrasenaEncriptada)
            .input('rol_id', sql.Int, rol_id)
            .query(`
                INSERT INTO usuarios (correo, contrasena, rol_id, activo)
                VALUES (@correo, @contrasena, @rol_id, 1)
            `);

        res.status(201).json({ message: 'Usuario registrado exitosamente en SSMS' });

    } catch (error) {
        console.error('Error en el registro:', error);
        res.status(500).json({ message: 'Error al registrar usuario (puede que el correo ya exista)' });
    }
};

exports.getUserProfile = async (req, res) => {
    // 🌟 AHORA SE LEE DE FORMA SEGURA DESDE EL TOKEN DESCIFRADO
    const usuario_id = req.usuario.id;
    const rol = req.usuario.rol; 

    try {
        const pool = await poolPromise;
        let query = '';
        const userRol = rol.toUpperCase();

        if (userRol === 'ALUMNO') {
            query = `SELECT id AS alumno_id, codigo_alumno, nombres, apellidos, fecha_nacimiento FROM alumnos WHERE usuario_id = @usuario_id`;
        } else if (userRol === 'PROFESOR') {
            query = `SELECT id AS profesor_id, codigo_empleado, nombres, apellidos, telefono FROM profesores WHERE usuario_id = @usuario_id`;
        } else if (userRol === 'ADMIN' || userRol === 'ADMINISTRADOR') {
            query = `SELECT id AS admin_id, 'Personal' AS nombres, 'Administrativo' AS apellidos, correo FROM usuarios WHERE id = @usuario_id`;
        } else {
            return res.status(400).json({ message: 'Rol no válido para obtener perfil.' });
        }

        const result = await pool.request()
            .input('usuario_id', sql.Int, usuario_id)
            .query(query);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'No se encontraron datos de perfil para este usuario.' });
        }

        res.json({
            rol: userRol,
            datos: result.recordset[0]
        });

    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({ message: 'Error interno al procesar el perfil.' });
    }
};