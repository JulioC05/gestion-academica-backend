module.exports = (rolesPermitidos) => {
    return (req, res, next) => {
        // req.usuario es inyectado previamente por el authMiddleware
        if (!req.usuario || !req.usuario.role) {
            // Evaluamos tanto 'role' como 'rol' por si acaso
            const userRol = req.usuario.rol || req.usuario.role;
            
            if (!rolesPermitidos.includes(userRol.toUpperCase())) {
                return res.status(403).json({ 
                    message: `Acceso denegado. Tu rol (${userRol}) no tiene permisos para realizar esta acción de administración.` 
                });
            }
            next();
        } else {
            const userRol = req.usuario.rol || req.usuario.role;
            if (!rolesPermitidos.includes(userRol.toUpperCase())) {
                return res.status(403).json({ message: 'Acceso denegado. Permisos insuficientes.' });
            }
            next();
        }
    };
};