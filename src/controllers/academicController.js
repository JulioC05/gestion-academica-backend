const { sql, poolPromise } = require('../config/db');

exports.getReportCard = async (req, res) => {
    const esAlumno = req.usuario.rol.toUpperCase() === 'ALUMNO';
    // Alumno consume desde su token, Admin pasa ?alumno_id=X
    const alumno_id = esAlumno ? req.usuario.id_entidad : req.query.alumno_id;

    if (!alumno_id) {
        return res.status(400).json({ message: 'Se requiere el parámetro alumno_id para la consulta de libreta.' });
    }

    try {
        const pool = await poolPromise;

        // 1. Consulta plana de alta velocidad que cruza las tablas esenciales
        const result = await pool.request()
            .input('alumno_id', sql.Int, parseInt(alumno_id))
            .query(`
                SELECT 
                    c.id AS curso_id,
                    c.nombre AS curso_nombre,
                    s.codigo_seccion AS grado_seccion,
                    ev.id AS evaluacion_id,
                    ev.nombre AS evaluacion_nombre,
                    ev.peso_porcentaje AS evaluacion_peso,
                    cal.nota AS nota_obtenida
                FROM matriculas m
                INNER JOIN detalle_matricula dm ON m.id = dm.matricula_id
                INNER JOIN secciones s ON dm.seccion_id = s.id
                INNER JOIN cursos c ON s.curso_id = c.id
                INNER JOIN evaluaciones ev ON s.id = ev.seccion_id
                -- LEFT JOIN clave: Si el profesor no ha subido nota, la fila aparece con nota NULL sin romperse
                LEFT JOIN calificaciones cal ON ev.id = cal.evaluacion_id AND cal.alumno_id = @alumno_id
                WHERE m.alumno_id = @alumno_id
                ORDER BY c.nombre ASC, ev.id ASC
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'No se encontraron registros académicos o asignaturas inscritas para este estudiante.' });
        }

        // 2. PROCESAMIENTO AL VUELO (Forzar CPU en Node.js para la prueba de estrés)
        const libretaMap = {};

        result.recordset.forEach(row => {
            if (!libretaMap[row.curso_id]) {
                libretaMap[row.curso_id] = {
                    curso_id: row.curso_id,
                    curso: row.curso_nombre,
                    seccion: row.grado_seccion,
                    evaluaciones: [],
                    promedio_final_actual: 0,
                    porcentaje_evaluado: 0
                };
            }

            const nota = row.nota_obtenida !== null ? parseFloat(row.nota_obtenida) : null;
            const peso = parseFloat(row.evaluacion_peso) / 100;

            libretaMap[row.curso_id].evaluaciones.push({
                evaluacion: row.evaluacion_nombre,
                peso_porcentaje: row.evaluacion_peso,
                nota: nota
            });

            // Si la nota existe, acumulamos su valor ponderado en tiempo real
            if (nota !== null) {
                libretaMap[row.curso_id].promedio_final_actual += (nota * peso);
                libretaMap[row.curso_id].porcentaje_evaluado += row.evaluacion_peso;
            }
        });

        // Convertimos el mapa intermedio en un arreglo limpio y redondeamos los promedios
        const libretaFinal = Object.values(libretaMap).map(curso => {
            // Si aún no se ha evaluado el 100%, calculamos el promedio en base a lo que se tiene
            const promedioRedondeado = curso.porcentaje_evaluado > 0 
                ? parseFloat((curso.promedio_final_actual * (100 / curso.porcentaje_evaluado)).toFixed(2))
                : 0;

            return {
                curso: curso.curso,
                seccion: curso.seccion,
                evaluaciones: curso.evaluaciones,
                promedio_parcial: promedioRedondeado
            };
        });

        res.json({
            alumno_id: parseInt(alumno_id),
            periodo_evaluado: "Año Escolar 2026",
            libreta: libretaFinal
        });

    } catch (error) {
        console.error('Error crítico al procesar la libreta de notas:', error);
        res.status(500).json({ message: 'Error interno del servidor al procesar la libreta electrónica.' });
    }
};

// POST /api/profesor/calificar
exports.submitBulkGrades = async (req, res) => {
    const { evaluacion_id, notas_alumnos } = req.body;

    // 1. Validaciones iniciales
    if (!evaluacion_id || !notas_alumnos || !Array.isArray(notas_alumnos) || notas_alumnos.length === 0) {
        return res.status(400).json({ 
            message: 'Estructura inválida. Se requiere evaluacion_id y un arreglo notas_alumnos con datos.' 
        });
    }

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // 2. Bucle para procesar cada nota en la base de datos
        for (const item of notas_alumnos) {
            const { alumno_id, nota } = item;

            if (alumno_id === undefined || nota === undefined) {
                await transaction.rollback();
                return res.status(400).json({ message: 'Falta alumno_id o nota en uno de los registros enviados.' });
            }

            // Validar rango de notas peruano (0 a 20)
            if (nota < 0 || nota > 20) {
                await transaction.rollback();
                return res.status(400).json({ message: `La nota ${nota} del alumno_id ${alumno_id} es inválida. Debe ser entre 0 y 20.` });
            }

            // 3. Upsert (Si ya existe nota para ese alumno en esa evaluación, la actualiza; si no, la inserta)
            await transaction.request()
                .input('evaluacion_id', sql.Int, parseInt(evaluacion_id))
                .input('alumno_id', sql.Int, parseInt(alumno_id))
                .input('nota', sql.Decimal(5, 2), parseFloat(nota))
                .query(`
                    MERGE calificaciones WITH (HOLDLOCK) AS target
                    USING (SELECT @evaluacion_id AS evaluacion_id, @alumno_id AS alumno_id) AS source
                    ON (target.evaluacion_id = source.evaluacion_id AND target.alumno_id = source.alumno_id)
                    WHEN MATCHED THEN
                        UPDATE SET nota = @nota, fecha_calificacion = GETDATE()
                    WHEN NOT MATCHED THEN
                        INSERT (evaluacion_id, alumno_id, nota, fecha_calificacion)
                        VALUES (@evaluacion_id, @alumno_id, @nota, GETDATE());
                `);
        }

        // Si todo el bucle se ejecutó sin problemas, consolidamos en la BD
        await transaction.commit();

        res.status(201).json({
            message: `Se registraron/actualizaron exitosamente ${notas_alumnos.length} calificaciones para la evaluación.`
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('Error crítico al registrar notas masivas:', error);
        res.status(500).json({ message: 'Error interno del servidor al procesar las calificaciones.' });
    }
};