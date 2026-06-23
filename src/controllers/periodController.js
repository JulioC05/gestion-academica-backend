const { sql, poolPromise } = require('../config/db');

// 1. LISTAR TODOS LOS PERIODOS
exports.getAllPeriods = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT id AS periodo_id, nombre, fecha_inicio, fecha_fin, estado 
            FROM periodos 
            ORDER BY fecha_inicio DESC
        `);
        res.json({ periodos: result.recordset });
    } catch (error) {
        console.error('Error al listar periodos:', error);
        res.status(500).json({ message: 'Error interno al obtener los periodos.' });
    }
};

// 2. CREAR UN NUEVO PERIODO (Con regla de activación única)
exports.createPeriod = async (req, res) => {
    const { nombre, fecha_inicio, fecha_fin, estado } = req.body;

    if (!nombre || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({ message: 'Faltan campos obligatorios (nombre, fecha_inicio, fecha_fin).' });
    }

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        const esActivo = estado === true || estado === 1 ? 1 : 0;

        // 🌟 REGLA DE NEGOCIO: Si el nuevo periodo entra como ACTIVO, apagamos todos los demás
        if (esActivo === 1) {
            await transaction.request().query(`UPDATE periodos SET estado = 0 WHERE estado = 1`);
        }

        const result = await transaction.request()
            .input('nombre', sql.VarChar(50), nombre)
            .input('fecha_inicio', sql.Date, fecha_inicio)
            .input('fecha_fin', sql.Date, fecha_fin)
            .input('estado', sql.Bit, esActivo)
            .query(`
                INSERT INTO periodos (nombre, fecha_inicio, fecha_fin, estado)
                OUTPUT INSERTED.id
                VALUES (@nombre, @fecha_inicio, @fecha_fin, @estado);
            `);

        await transaction.commit();
        res.status(201).json({
            message: 'Periodo académico creado exitosamente.',
            periodo_id: result.recordset[0].id,
            activo: esActivo === 1
        });
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('Error al crear periodo:', error);
        res.status(500).json({ message: 'Error interno al procesar el registro.' });
    }
};

// 3. EDITAR UN PERIODO EXISTENTE
exports.updatePeriod = async (req, res) => {
    const { id } = req.params;
    const { nombre, fecha_inicio, fecha_fin, estado } = req.body;

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        const esActivo = estado === true || estado === 1 ? 1 : 0;

        // 🌟 REGLA DE NEGOCIO: Si se activa este periodo, apagamos el resto
        if (esActivo === 1) {
            await transaction.request().query(`UPDATE periodos SET estado = 0 WHERE estado = 1`);
        }

        const result = await transaction.request()
            .input('id', sql.Int, id)
            .input('nombre', sql.VarChar(50), nombre)
            .input('fecha_inicio', sql.Date, fecha_inicio)
            .input('fecha_fin', sql.Date, fecha_fin)
            .input('estado', sql.Bit, esActivo)
            .query(`
                UPDATE periodos 
                SET nombre = @nombre, fecha_inicio = @fecha_inicio, fecha_fin = @fecha_fin, estado = @estado
                WHERE id = @id
            `);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).json({ message: 'El periodo académico no existe.' });
        }

        await transaction.commit();
        res.json({ message: 'Periodo académico actualizado con éxito.' });
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('Error al actualizar periodo:', error);
        res.status(500).json({ message: 'Error interno al actualizar el periodo.' });
    }
};

// 4. ELIMINAR UN PERIODO (Con validación de uso)
exports.deletePeriod = async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await poolPromise;

        // 🌟 REGLA DE NEGOCIO: Validar si está amarrado a secciones o matrículas creadas
        const checkUso = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT 
                    (SELECT COUNT(1) FROM secciones WHERE periodo_id = @id) AS en_secciones,
                    (SELECT COUNT(1) FROM matriculas WHERE periodo_id = @id) AS en_matriculas
            `);

        const { en_secciones, en_matriculas } = checkUso.recordset[0];

        if (en_secciones > 0 || en_matriculas > 0) {
            return res.status(400).json({ 
                message: 'No se puede eliminar el periodo porque ya cuenta con aulas configuradas o alumnos matriculados.' 
            });
        }

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM periodos WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'El periodo académico no existe.' });
        }

        res.json({ message: 'Periodo académico eliminado correctamente del sistema.' });
    } catch (error) {
        console.error('Error al eliminar periodo:', error);
        res.status(500).json({ message: 'Error interno al intentar eliminar el periodo.' });
    }
};