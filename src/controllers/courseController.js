const { sql, poolPromise } = require('../config/db');

// 1. LISTAR TODOS LOS CURSOS
exports.getAllCourses = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT id AS curso_id, codigo_curso, nombre, creditos 
            FROM cursos 
            ORDER BY nombre ASC
        `);
        res.json({ cursos: result.recordset });
    } catch (error) {
        console.error('Error al listar cursos:', error);
        res.status(500).json({ message: 'Error interno al obtener los cursos.' });
    }
};

// 2. CREAR UN NUEVO CURSO
exports.createCourse = async (req, res) => {
    const { codigo_curso, nombre, creditos } = req.body;

    if (!codigo_curso || !nombre || creditos === undefined) {
        return res.status(400).json({ message: 'Faltan campos obligatorios (codigo_curso, nombre, creditos).' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('codigo_curso', sql.VarChar(20), codigo_curso)
            .input('nombre', sql.VarChar(150), nombre)
            .input('creditos', sql.Int, creditos)
            .query(`
                INSERT INTO cursos (codigo_curso, nombre, creditos)
                OUTPUT INSERTED.id
                VALUES (@codigo_curso, @nombre, @creditos);
            `);

        res.status(201).json({
            message: 'Curso creado exitosamente en el catálogo escolar.',
            curso_id: result.recordset[0].id
        });
    } catch (error) {
        console.error('Error al crear curso:', error);
        // Manejo específico del código UNIQUE duplicado
        if (error.message.includes('UNIQUE KEY') || error.message.includes('violación')) {
            return res.status(400).json({ message: `El código de curso '${codigo_curso}' ya se encuentra registrado en el sistema.` });
        }
        res.status(500).json({ message: 'Error interno al procesar el registro del curso.' });
    }
};

// 3. EDITAR UN CURSO EXISTENTE
exports.updateCourse = async (req, res) => {
    const { id } = req.params;
    const { codigo_curso, nombre, creditos } = req.body;

    if (!codigo_curso || !nombre || creditos === undefined) {
        return res.status(400).json({ message: 'Faltan campos obligatorios para actualizar.' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('codigo_curso', sql.VarChar(20), codigo_curso)
            .input('nombre', sql.VarChar(150), nombre)
            .input('creditos', sql.Int, creditos)
            .query(`
                UPDATE cursos 
                SET codigo_curso = @codigo_curso, nombre = @nombre, creditos = @creditos
                WHERE id = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'El curso solicitado no existe.' });
        }

        res.json({ message: 'Curso actualizado con éxito en el catálogo.' });
    } catch (error) {
        console.error('Error al actualizar curso:', error);
        if (error.message.includes('UNIQUE KEY') || error.message.includes('violación')) {
            return res.status(400).json({ message: 'El código de curso ingresado ya pertenece a otra asignatura.' });
        }
        res.status(500).json({ message: 'Error interno al actualizar el curso.' });
    }
};

// 4. ELIMINAR UN CURSO (Validando restricción de uso)
exports.deleteCourse = async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await poolPromise;

        // 🌟 REGLA DE NEGOCIO: Validar si el curso está amarrado a alguna sección abierta
        const checkUso = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT COUNT(1) AS en_uso FROM secciones WHERE curso_id = @id');

        if (checkUso.recordset[0].en_uso > 0) {
            return res.status(400).json({ 
                message: 'No se puede eliminar el curso porque actualmente tiene aulas o secciones académicas activas asignadas.' 
            });
        }

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM cursos WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'El curso no existe.' });
        }

        res.json({ message: 'Curso eliminado correctamente del catálogo.' });
    } catch (error) {
        console.error('Error al eliminar curso:', error);
        res.status(500).json({ message: 'Error interno al intentar eliminar el curso.' });
    }
};