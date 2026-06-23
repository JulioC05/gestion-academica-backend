const { sql, poolPromise } = require('../config/db');
const bcrypt = require('bcryptjs');

exports.createUserEntity = async (req, res) => {
    const { correo, contrasena, rol_id, tipo_persona, datos_perfil } = req.body;

    // 1. Validaciones estructurales básicas
    if (!correo || !contrasena || !rol_id || !tipo_persona || !datos_perfil) {
        return res.status(400).json({ message: 'Faltan parámetros críticos en la solicitud.' });
    }

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        // 2. Encriptar la contraseña del nuevo usuario
        const salt = await bcrypt.genSalt(10);
        const hashContrasena = await bcrypt.hash(contrasena, salt);

        // Iniciar la transacción ACID
        await transaction.begin();

        // 3. PASO A: Insertar en la tabla USUARIOS
        const userResult = await transaction.request()
            .input('correo', sql.VarChar(100), correo)
            .input('contrasena', sql.VarChar(255), hashContrasena)
            .input('rol_id', sql.Int, rol_id)
            .query(`
                INSERT INTO usuarios (correo, contrasena, rol_id, activo)
                OUTPUT INSERTED.id
                VALUES (@correo, @contrasena, @rol_id, 1);
            `);

        const nuevoUsuarioId = userResult.recordset[0].id;
        const tipo = tipo_persona.toUpperCase();

        // 4. PASO B: Evaluar la entidad secundaria a registrar en cascada
        if (tipo === 'ALUMNO') {
            const { codigo_alumno, nombres, apellidos, fecha_nacimiento } = datos_perfil;
            
            await transaction.request()
                .input('usuario_id', sql.Int, nuevoUsuarioId)
                .input('codigo_alumno', sql.VarChar(20), codigo_alumno)
                .input('nombres', sql.VarChar(100), nombres)
                .input('apellidos', sql.VarChar(100), apellidos)
                .input('fecha_nacimiento', sql.Date, fecha_nacimiento)
                .query(`
                    INSERT INTO alumnos (usuario_id, codigo_alumno, nombres, apellidos, fecha_nacimiento)
                    VALUES (@usuario_id, @codigo_alumno, @nombres, @apellidos, @fecha_nacimiento);
                `);

        } else if (tipo === 'PROFESOR') {
            const { codigo_empleado, nombres, apellidos, telefono } = datos_perfil;

            await transaction.request()
                .input('usuario_id', sql.Int, nuevoUsuarioId)
                .input('codigo_empleado', sql.VarChar(20), codigo_empleado)
                .input('nombres', sql.VarChar(100), nombres)
                .input('apellidos', sql.VarChar(100), apellidos)
                .input('telefono', sql.VarChar(20), telefono)
                .query(`
                    INSERT INTO profesores (usuario_id, codigo_empleado, nombres, apellidos, telefono)
                    VALUES (@usuario_id, @codigo_empleado, @nombres, @apellidos, @telefono);
                `);
        } else {
            await transaction.rollback();
            return res.status(400).json({ message: 'Tipo de persona no mapeado en el sistema escolar.' });
        }

        // Si ambas inserciones fueron exitosas, consolidamos en la BD
        await transaction.commit();

        res.status(201).json({
            message: `Usuario y perfil de ${tipo} creados exitosamente en el sistema.`,
            usuario_id: nuevoUsuarioId,
            correo: correo
        });

    } catch (error) {
        // Cancelación y resguardo ante cualquier error (Ej: Código duplicado o correo ya registrado)
        if (transaction) await transaction.rollback();
        console.error('Error en la alta transaccional de usuario:', error);
        
        if (error.message.includes('UNIQUE KEY') || error.message.includes('violación')) {
            return res.status(400).json({ message: 'El correo o código de empleado/alumno ya se encuentra registrado.' });
        }
        res.status(500).json({ message: 'Error interno del servidor al procesar el alta.' });
    }
};