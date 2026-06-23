const { sql, poolPromise } = require('../config/db');

// 1. LISTAR TODAS LAS SECCIONES (Incluyendo el Horario)
exports.getAllSections = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 
                s.id AS seccion_id,
                s.codigo_seccion AS grado_seccion,
                s.cupo_maximo,
                s.cupos_disponibles,
                s.horario, 
                c.nombre AS curso,
                pe.nombre AS periodo,
                p.nombres + ' ' + p.apellidos AS profesor
            FROM secciones s
            INNER JOIN cursos c ON s.curso_id = c.id
            INNER JOIN periodos pe ON s.periodo_id = pe.id
            INNER JOIN profesores p ON s.profesor_id = p.id
            ORDER BY pe.fecha_inicio DESC, s.codigo_seccion ASC
        `);
        res.json({ secciones: result.recordset });
    } catch (error) {
        console.error('Error al listar secciones:', error);
        res.status(500).json({ message: 'Error interno al obtener las secciones.' });
    }
};

// 2. CREAR UNA SECCIÓN
exports.createSection = async (req, res) => {
    const { curso_id, periodo_id, profesor_id, codigo_seccion, cupo_maximo, horario } = req.body;

    if (!curso_id || !periodo_id || !profesor_id || !codigo_seccion || !cupo_maximo || !horario) {
        return res.status(400).json({ message: 'Faltan campos obligatorios para configurar la sección (incluyendo el horario).' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('curso_id', sql.Int, parseInt(curso_id))
            .input('periodo_id', sql.Int, parseInt(periodo_id))
            .input('profesor_id', sql.Int, parseInt(profesor_id))
            .input('codigo_seccion', sql.VarChar(30), String(codigo_seccion))
            .input('cupo_maximo', sql.Int, parseInt(cupo_maximo))
            .input('cupos_disponibles', sql.Int, parseInt(cupo_maximo)) 
            .input('horario', sql.VarChar(100), String(horario))
            .query(`
                INSERT INTO secciones (curso_id, periodo_id, profesor_id, codigo_seccion, cupo_maximo, cupos_disponibles, horario)
                OUTPUT INSERTED.id
                VALUES (@curso_id, @periodo_id, @profesor_id, @codigo_seccion, @cupo_maximo, @cupos_disponibles, @horario);
            `);

        res.status(201).json({
            message: 'Sección/Aula creada y aperturada con éxito en el sistema escolar.',
            seccion_id: result.recordset[0].id
        });
    } catch (error) {
        console.error('Error al crear sección con horario:', error);
        res.status(500).json({ message: 'Error interno al procesar el alta de la sección.' });
    }
};

// 3. EDITAR UNA SECCIÓN
exports.updateSection = async (req, res) => {
    const { id } = req.params;
    const { curso_id, periodo_id, profesor_id, codigo_seccion, cupo_maximo, cupos_disponibles, horario } = req.body;

    if (!id || !curso_id || !periodo_id || !profesor_id || !codigo_seccion || cupo_maximo === undefined || cupos_disponibles === undefined || !horario) {
        return res.status(400).json({ message: 'Faltan campos requeridos para actualizar la sección.' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, parseInt(id))
            .input('curso_id', sql.Int, parseInt(curso_id))
            .input('periodo_id', sql.Int, parseInt(periodo_id))
            .input('profesor_id', sql.Int, parseInt(profesor_id))
            .input('codigo_seccion', sql.VarChar(30), String(codigo_seccion))
            .input('cupo_maximo', sql.Int, parseInt(cupo_maximo))
            .input('cupos_disponibles', sql.Int, parseInt(cupos_disponibles))
            .input('horario', sql.VarChar(100), String(horario)) 
            .query(`
                UPDATE secciones 
                SET curso_id = @curso_id, 
                    periodo_id = @periodo_id, 
                    profesor_id = @profesor_id, 
                    codigo_seccion = @codigo_seccion, 
                    cupo_maximo = @cupo_maximo, 
                    cupos_disponibles = @cupos_disponibles,
                    horario = @horario -- 🌟 Actualización del campo horario
                WHERE id = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'La sección solicitada no existe.' });
        }

        res.json({ message: 'Sección actualizada con éxito con su respectivo horario.' });
    } catch (error) {
        console.error('Error al actualizar sección:', error);
        res.status(500).json({ message: 'Error interno al actualizar la sección.' });
    }
};

// 4. ELIMINAR UNA SECCIÓN
exports.deleteSection = async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await poolPromise;

        // Validar si hay alumnos usando esta sección en detalle_matricula
        const checkMatriculas = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT COUNT(1) AS matriculados FROM detalle_matricula WHERE seccion_id = @id');

        if (checkMatriculas.recordset[0].matriculados > 0) {
            return res.status(400).json({ 
                message: 'No se puede eliminar la sección porque ya cuenta con alumnos matriculados en ella.' 
            });
        }

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM secciones WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'La sección no existe.' });
        }

        res.json({ message: 'Sección eliminada correctamente del sistema.' });
    } catch (error) {
        console.error('Error al eliminar sección:', error);
        res.status(500).json({ message: 'Error interno al intentar eliminar la sección.' });
    }
};