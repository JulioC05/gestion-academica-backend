const { sql, poolPromise } = require('../config/db');

exports.processEnrollment = async (req, res) => {
    const esAlumno = req.usuario.rol.toUpperCase() === 'ALUMNO';
    const alumno_id = esAlumno ? req.usuario.id_entidad : req.body.alumno_id; 
    const { periodo_id, seccion_id } = req.body;

    if (!alumno_id || !periodo_id || !seccion_id) {
        return res.status(400).json({ message: 'Faltan parámetros requeridos (alumno_id, periodo_id, seccion_id).' });
    }

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // 1. REGLA: Validación de Vacantes y Horario de la Sección
        const seccionCheck = await transaction.request()
            .input('seccion_id', sql.Int, seccion_id)
            .query(`
                SELECT s.cupos_disponibles, s.horario, s.codigo_seccion, c.id AS curso_id, c.nombre AS curso_nombre
                FROM secciones s WITH (ROWLOCK)
                INNER JOIN cursos c ON s.curso_id = c.id
                WHERE s.id = @seccion_id
            `);

        if (seccionCheck.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ message: 'La sección o aula solicitada no existe.' });
        }

        const { cupos_disponibles, horario: horarioNuevo, curso_id: cursoNuevoId, curso_nombre: cursoNombre } = seccionCheck.recordset[0];

        if (cupos_disponibles <= 0) {
            await transaction.rollback();
            return res.status(400).json({ message: 'Ya no quedan vacantes disponibles en esta sección escolar.' });
        }

        // Obtener o crear cabecera de matrícula
        const matriculaExistente = await transaction.request()
            .input('alumno_id', sql.Int, alumno_id)
            .input('periodo_id', sql.Int, periodo_id)
            .query(`SELECT id FROM matriculas WHERE alumno_id = @alumno_id AND periodo_id = @periodo_id`);

        let matriculaId;
        if (matriculaExistente.recordset.length > 0) {
            matriculaId = matriculaExistente.recordset[0].id;
        } else {
            const nuevaMatricula = await transaction.request()
                .input('alumno_id', sql.Int, alumno_id)
                .input('periodo_id', sql.Int, periodo_id)
                .query(`
                    INSERT INTO matriculas (alumno_id, periodo_id, fecha_matricula)
                    OUTPUT INSERTED.id
                    VALUES (@alumno_id, @periodo_id, GETDATE());
                `);
            matriculaId = nuevaMatricula.recordset[0].id;
        }

        // 2. REGLA MINEDU: No doble inscripción en el mismo curso (Evita llevar dos veces Educación Física en el mismo año)
        const cursoInscritoCheck = await transaction.request()
            .input('matricula_id', sql.Int, matriculaId)
            .input('curso_id', sql.Int, cursoNuevoId)
            .query(`
                SELECT dm.id 
                FROM detalle_matricula dm
                INNER JOIN secciones s ON dm.seccion_id = s.id
                WHERE dm.matricula_id = @matricula_id AND s.curso_id = @curso_id
            `);

        if (cursoInscritoCheck.recordset.length > 0) {
            await transaction.rollback();
            return res.status(400).json({ message: `El estudiante ya se encuentra registrado en el curso de '${cursoNombre}' para este año escolar.` });
        }

        // 3. REGLA: Límite Máximo de Cursos (Máximo 20 cursos por alumno)
        const conteoCursosCheck = await transaction.request()
            .input('matricula_id', sql.Int, matriculaId)
            .query(`
                SELECT COUNT(1) AS total_cursos 
                FROM detalle_matricula 
                WHERE matricula_id = @matricula_id
            `);

        const totalCursosMatriculados = conteoCursosCheck.recordset[0].total_cursos;
        if (totalCursosMatriculados >= 20) {
            await transaction.rollback();
            return res.status(400).json({ 
                message: `Límite de asignaturas alcanzado. El alumno ya cuenta con el máximo permitido de 20 cursos inscritos.` 
            });
        }

        // 4. REGLA: Cruce de Horarios en el mismo salón/horario escolar
        const horariosCheck = await transaction.request()
            .input('matricula_id', sql.Int, matriculaId)
            .input('horario_nuevo', sql.VarChar(100), horarioNuevo)
            .query(`
                SELECT s.codigo_seccion, c.nombre AS curso
                FROM detalle_matricula dm
                INNER JOIN secciones s ON dm.seccion_id = s.id
                INNER JOIN cursos c ON s.curso_id = c.id
                WHERE dm.matricula_id = @matricula_id AND s.horario = @horario_nuevo
            `);

        if (horariosCheck.recordset.length > 0) {
            const cruce = horariosCheck.recordset[0];
            await transaction.rollback();
            return res.status(400).json({ 
                message: `Cruce de horario. El horario [${horarioNuevo}] coincide con el curso '${cruce.curso}' ya registrado.` 
            });
        }

        // PASO ESCRITURA 1: Insertar en Detalle de Matrícula
        await transaction.request()
            .input('matricula_id', sql.Int, matriculaId)
            .input('seccion_id', sql.Int, seccion_id)
            .query(`INSERT INTO detalle_matricula (matricula_id, seccion_id) VALUES (@matricula_id, @seccion_id)`);

        // PASO ESCRITURA 2: Descontar vacante de la Sección
        await transaction.request()
            .input('seccion_id', sql.Int, seccion_id)
            .query(`UPDATE secciones SET cupos_disponibles = cupos_disponibles - 1 WHERE id = @seccion_id`);

        await transaction.commit();

        res.status(201).json({
            message: 'Matrícula procesada y registrada de forma exitosa bajo el estándar escolar.',
            matricula_id: matriculaId,
            seccion_registrada: seccion_id,
            total_cursos_actuales: totalCursosMatriculados + 1
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('Error crítico transaccional de matrícula:', error);
        res.status(500).json({ message: 'Error interno del servidor al procesar el flujo seguro de matrícula escolar.' });
    }
};

exports.getMyCourses = async (req, res) => {
    const esAlumno = req.usuario.rol.toUpperCase() === 'ALUMNO';
    
    // 🌟 SI ES ALUMNO: Usa su propio ID del token.
    // 🌟 SI ES ADMIN: Busca el 'alumno_id' que viaja en la query string (?alumno_id=4)
    const alumno_id = esAlumno ? req.usuario.id_entidad : req.query.alumno_id;

    if (!alumno_id) {
        return res.status(400).json({ message: 'Se requiere el parámetro alumno_id para la consulta administrativa.' });
    }

    try {
        const pool = await poolPromise;
        
        // Modificamos el WHERE para buscar directamente por el ID de la tabla alumnos
        const result = await pool.request()
            .input('alumno_id', sql.Int, parseInt(alumno_id))
            .query(`
                SELECT 
                    m.id AS matricula_id,
                    m.fecha_matricula,
                    s.codigo_seccion AS grado_seccion,
                    s.horario,
                    c.nombre AS curso,
                    p.nombres + ' ' + p.apellidos AS profesor
                FROM matriculas m
                INNER JOIN detalle_matricula dm ON m.id = dm.matricula_id
                INNER JOIN secciones s ON dm.seccion_id = s.id
                INNER JOIN cursos c ON s.curso_id = c.id
                INNER JOIN profesores p ON s.profesor_id = p.id
                WHERE m.alumno_id = @alumno_id
                ORDER BY s.codigo_seccion ASC
            `);

        res.json({ 
            alumno_id_consultado: parseInt(alumno_id),
            total_cursos: result.recordset.length,
            cursos_matriculados: result.recordset 
        });
    } catch (error) {
        console.error('Error al obtener cursos del alumno:', error);
        res.status(500).json({ message: 'Error interno al obtener el historial de cursos.' });
    }
};

exports.dropSection = async (req, res) => {
    const esAlumno = req.usuario.rol.toUpperCase() === 'ALUMNO';
    const alumno_id = esAlumno ? req.usuario.id_entidad : req.body.alumno_id;
    const { seccion_id, periodo_id } = req.body;

    if (!alumno_id || !seccion_id || !periodo_id) {
        return res.status(400).json({ message: 'Faltan parámetros requeridos (alumno_id, seccion_id, periodo_id).' });
    }

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // PASO 1: Verificar que la matrícula y el detalle existan realmente para ese alumno y periodo
        const registroCheck = await transaction.request()
            .input('alumno_id', sql.Int, alumno_id)
            .input('periodo_id', sql.Int, periodo_id)
            .input('seccion_id', sql.Int, seccion_id)
            .query(`
                SELECT dm.id AS detalle_id, m.id AS matricula_id
                FROM detalle_matricula dm
                INNER JOIN matriculas m ON dm.matricula_id = m.id
                WHERE m.alumno_id = @alumno_id AND m.periodo_id = @periodo_id AND dm.seccion_id = @seccion_id
            `);

        if (registroCheck.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ message: 'No se encontró una inscripción activa para este estudiante en la sección indicada.' });
        }

        const { detalle_id, matricula_id } = registroCheck.recordset[0];

        // PASO 2: Eliminar el registro del puente detalle_matricula
        await transaction.request()
            .input('detalle_id', sql.Int, detalle_id)
            .query(`DELETE FROM detalle_matricula WHERE id = @detalle_id`);

        // PASO 3: Devolver la vacante a la sección (+1 cupo disponible)
        await transaction.request()
            .input('seccion_id', sql.Int, seccion_id)
            .query(`UPDATE secciones SET cupos_disponibles = cupos_disponibles + 1 WHERE id = @seccion_id`);

        // PASO Opcional de Limpieza: Si el alumno se retiró de su ÚLTIMO curso, borramos la cabecera para no dejar registros huérfanos
        const conteoRestante = await transaction.request()
            .input('matricula_id', sql.Int, matricula_id)
            .query(`SELECT COUNT(1) AS restantes FROM detalle_matricula WHERE matricula_id = @matricula_id`);

        if (conteoRestante.recordset[0].restantes === 0) {
            await transaction.request()
                .input('matricula_id', sql.Int, matricula_id)
                .query(`DELETE FROM matriculas WHERE id = @matricula_id`);
        }

        await transaction.commit();

        res.json({
            message: 'Retiro de asignatura procesado con éxito. La vacante ha sido liberada.'
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('Error crítico en el proceso de desmatrícula:', error);
        res.status(500).json({ message: 'Error interno del servidor al procesar el retiro escolar.' });
    }
};