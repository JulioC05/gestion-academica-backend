const { sql, poolPromise } = require('../config/db');

exports.processEnrollment = async (req, res) => {
    const { usuario_id, seccion_id } = req.body;

    if (!usuario_id || !seccion_id) {
        return res.status(400).json({ message: 'El ID de usuario y la sección son requeridos.' });
    }

    let transaction;

    try {
        const pool = await poolPromise;
        
        // 1. Iniciar la Transacción
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        // 2. BUSCAR EL ALUMNO_ID REAL basándonos en el usuario_id del Login
        const buscarAlumno = await transaction.request()
            .input('usuario_id', sql.Int, usuario_id)
            .query(`SELECT id FROM alumnos WHERE usuario_id = @usuario_id`);

        if (buscarAlumno.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ message: 'No se encontró la ficha escolar (perfil de alumno) para este usuario.' });
        }

        const realAlumnoId = buscarAlumno.recordset[0].id; // Este es el ID de la tabla 'alumnos'

        // 3. Verificar vacantes actuales
        const checkVacantes = await transaction.request()
            .input('seccion_id', sql.Int, seccion_id)
            .query(`SELECT cupos_disponibles, periodo_id FROM secciones WITH (ROWLOCK) WHERE id = @seccion_id`);

        if (checkVacantes.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ message: 'La sección seleccionada no existe.' });
        }

        const { cupos_disponibles, periodo_id } = checkVacantes.recordset[0];

        if (cupos_disponibles <= 0) {
            await transaction.rollback();
            return res.status(400).json({ message: '¡Lo sentimos! Ya no quedan vacantes disponibles.' });
        }

        // 4. Registrar la Matrícula usando el REAL alumno_id
        const insertMatricula = await transaction.request()
            .input('alumno_id', sql.Int, realAlumnoId)
            .input('periodo_id', sql.Int, periodo_id)
            .query(`
                INSERT INTO matriculas (alumno_id, periodo_id, fecha_matricula)
                OUTPUT INSERTED.id
                VALUES (@alumno_id, @periodo_id, GETDATE())
            `);

        const matriculaId = insertMatricula.recordset[0].id;

        // 5. Restar la vacante
        await transaction.request()
            .input('seccion_id', sql.Int, seccion_id)
            .query(`UPDATE secciones SET cupos_disponibles = cupos_disponibles - 1 WHERE id = @seccion_id`);

        // Consolidamos la transacción
        await transaction.commit();

        res.status(201).json({
            message: '🎉 ¡Matrícula procesada con éxito!',
            codigo_matricula: `MAT-2026-${matriculaId}`,
            detalle: {
                alumno_id: realAlumnoId,
                seccion_id,
                vacantes_restantes: cupos_disponibles - 1
            }
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('Error crítico en la transacción de matrícula:', error.message);
        res.status(500).json({ message: 'Error interno al procesar la matrícula transaccional.' });
    }
};