const { sql, poolPromise } = require('../config/db');

// GET /api/evaluaciones/profesor/mis-secciones
exports.getTeacherSections = async (req, res) => {
    // 🌟 Extraído de forma segura desde el Token JWT descifrado
    const usuario_id = req.usuario.id; 

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('usuario_id', sql.Int, usuario_id)
            .query(`
                SELECT s.id AS seccion_id, s.codigo_seccion AS grado_seccion, s.horario, c.nombre AS curso
                FROM secciones s
                INNER JOIN cursos c ON s.curso_id = c.id
                INNER JOIN profesores p ON s.profesor_id = p.id
                WHERE p.usuario_id = @usuario_id
            `);
        res.json({ secciones: result.recordset });
    } catch (error) {
        console.error('Error al obtener secciones del docente:', error);
        res.status(500).json({ message: 'Error interno al obtener secciones del docente.' });
    }
};

// GET /api/evaluaciones/profesor/secciones/:id/alumnos
exports.getSectionStudents = async (req, res) => {
    const { id } = req.params; // ID de la Sección/Aula
    const esAlumno = req.usuario.rol.toUpperCase() === 'ALUMNO';

    // 🌟 REGLA DE SEGURIDAD BLINDADA: Un alumno jamás debería poder auditar un salón entero
    if (esAlumno) {
        return res.status(403).json({ message: 'Acceso denegado. Rol no autorizado para auditar planillas.' });
    }

    try {
        const pool = await poolPromise;
        
        // 🌟 CONSULTA DE AUDITORÍA: Trae los alumnos matriculados en esa sección 
        // y cruza sus calificaciones actuales en tiempo real para el visor del Admin/Profesor.
        const result = await pool.request()
            .input('seccion_id', sql.Int, parseInt(id))
            .query(`
                SELECT 
                    al.id AS alumno_id,
                    al.codigo_alumno,
                    al.apellidos + ', ' + al.nombres AS estudiante,
                    ev.nombre AS evaluacion,
                    ev.peso_porcentaje AS peso,
                    cal.nota AS nota_registrada
                FROM detalle_matricula dm
                INNER JOIN matriculas m ON dm.matricula_id = m.id
                INNER JOIN alumnos al ON m.alumno_id = al.id
                INNER JOIN secciones s ON dm.seccion_id = s.id
                LEFT JOIN evaluaciones ev ON s.id = ev.seccion_id
                LEFT JOIN calificaciones cal ON ev.id = cal.evaluacion_id AND cal.alumno_id = al.id
                WHERE dm.seccion_id = @seccion_id
                ORDER BY al.apellidos ASC, ev.id ASC
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'No se encontraron alumnos inscritos o evaluaciones configuradas en esta sección.' });
        }

        // Agrupamos en el servidor para entregar un JSON limpio por alumno (Estructura Scannable)
        const alumnosMap = {};
        result.recordset.forEach(row => {
            if (!alumnosMap[row.alumno_id]) {
                alumnosMap[row.alumno_id] = {
                    alumno_id: row.alumno_id,
                    codigo: row.codigo_alumno,
                    estudiante: row.estudiante,
                    calificaciones: []
                };
            }
            if (row.evaluacion) {
                alumnosMap[row.alumno_id].calificaciones.push({
                    evaluacion: row.evaluacion,
                    peso_porcentaje: row.peso,
                    nota: row.nota_registrada !== null ? parseFloat(row.nota_registrada) : null
                });
            }
        });

        res.json({
            seccion_id: parseInt(id),
            total_estudiantes: Object.keys(alumnosMap).length,
            planilla: Object.values(alumnosMap)
        });

    } catch (error) {
        console.error('Error en auditoría de sección para administración:', error);
        res.status(500).json({ message: 'Error interno del servidor al procesar la planilla de la sección.' });
    }
};

// POST /api/evaluaciones/registrar
exports.createEvaluation = async (req, res) => {
    const { seccion_id, tipo_evaluacion_id, nombre, peso_porcentaje } = req.body;

    if (!seccion_id || !tipo_evaluacion_id || !nombre || !peso_porcentaje) {
        return res.status(400).json({ message: 'Faltan parámetros obligatorios para crear la evaluación.' });
    }

    try {
        const pool = await poolPromise;
        
        // Regla de consistencia: Verificar que los pesos acumulados de la sección no superen el 100%
        const pesoCheck = await pool.request()
            .input('seccion_id', sql.Int, seccion_id)
            .query('SELECT SUM(peso_porcentaje) AS total_peso FROM evaluaciones WHERE seccion_id = @seccion_id');
        
        const totalExistente = pesoCheck.recordset[0].total_peso || 0;
        if (parseFloat(totalExistente) + parseFloat(peso_porcentaje) > 100) {
            return res.status(400).json({ 
                message: `No se puede crear. La suma de pesos superaría el 100%. Actualmente el salón tiene acumulado un ${totalExistente}%.` 
            });
        }

        const result = await pool.request()
            .input('seccion_id', sql.Int, parseInt(seccion_id))
            .input('tipo_evaluacion_id', sql.Int, parseInt(tipo_evaluacion_id))
            .input('nombre', sql.VarChar(100), String(nombre))
            .input('peso_porcentaje', sql.Decimal(5,2), parseFloat(peso_porcentaje))
            .query(`
                INSERT INTO evaluaciones (seccion_id, tipo_evaluacion_id, nombre, peso_porcentaje, fecha_entrega)
                OUTPUT INSERTED.id
                VALUES (@seccion_id, @tipo_evaluacion_id, @nombre, @peso_porcentaje, GETDATE());
            `);
            
        res.status(201).json({ 
            message: 'Evaluación configurada con éxito en el silabo del salón.', 
            evaluacion_id: result.recordset[0].id 
        });
    } catch (error) {
        console.error('Error al crear la evaluación:', error);
        res.status(500).json({ message: 'Error interno al crear la evaluación.' });
    }
};

// POST /api/evaluaciones/calificaciones/registrar (Individual)
exports.registerGrade = async (req, res) => {
    const { evaluacion_id, alumno_id, nota } = req.body;

    if (evaluacion_id === undefined || alumno_id === undefined || nota === undefined) {
        return res.status(400).json({ message: 'Faltan parámetros requeridos (evaluacion_id, alumno_id, nota).' });
    }

    // Regla escolar del Perú: Sistema vigesimal
    if (nota < 0 || nota > 20) {
        return res.status(400).json({ message: 'La nota ingresada es inválida. Debe estar en el rango de 0 a 20.' });
    }

    try {
        const pool = await poolPromise;
        await pool.request()
            .input('evaluacion_id', sql.Int, parseInt(evaluacion_id))
            .input('alumno_id', sql.Int, parseInt(alumno_id))
            .input('nota', sql.Decimal(5,2), parseFloat(nota))
            .query(`
                MERGE calificaciones WITH (HOLDLOCK) AS target
                USING (SELECT @evaluacion_id AS ev_id, @alumno_id AS al_id) AS source
                ON (target.evaluacion_id = source.ev_id AND target.alumno_id = source.al_id)
                WHEN MATCHED THEN
                    UPDATE SET nota = @nota, fecha_calificacion = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (evaluacion_id, alumno_id, nota, fecha_calificacion)
                    VALUES (@evaluacion_id, @alumno_id, @nota, GETDATE());
            `);

        res.status(200).json({ message: 'Calificación registrada/actualizada de manera correcta.' });
    } catch (error) {
        console.error('Error al registrar la calificación individual:', error);
        res.status(500).json({ message: 'Error interno al registrar la nota en el sistema.' });
    }
};