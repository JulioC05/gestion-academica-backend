const { sql, poolPromise } = require('../config/db');

exports.getAvailableCatalog = async (req, res) => {
    try {
        const pool = await poolPromise;

        // Cambiamos los nombres de los campos para el entorno escolar peruano
        const result = await pool.request().query(`
            SELECT 
                s.id AS seccion_id,
                s.codigo_seccion AS grado_seccion, -- Ej: '1ERO SEC - A'
                s.cupo_maximo AS vacantes_totales,
                s.cupos_disponibles AS vacantes_disponibles,
                c.codigo_curso,
                c.nombre AS curso_base,
                p.nombres + ' ' + p.apellidos AS tutor_profesor,
                pe.nombre AS anio_escolar
            FROM secciones s
            INNER JOIN cursos c ON s.curso_id = c.id
            INNER JOIN profesores p ON s.profesor_id = p.id
            INNER JOIN periodos pe ON s.periodo_id = pe.id
            WHERE pe.estado = 1 -- Solo el año escolar activo
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'No hay vacantes o grados disponibles para este año escolar.' });
        }

        res.json({
            anio_escolar: result.recordset[0].anio_escolar,
            total_opciones: result.recordset.length,
            matricula_disponible: result.recordset
        });

    } catch (error) {
        console.error('Error al obtener el catálogo escolar:', error);
        res.status(500).json({ message: 'Error interno del servidor al procesar las vacantes escolares' });
    }
};