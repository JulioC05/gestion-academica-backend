const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // 1. Extraer la cabecera Authorization
    const authHeader = req.headers['authorization'];
    
    // El estándar Bearer envía: "Bearer eyJhbGciOi..."
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. No se proporcionó un token de autenticación.' });
    }

    try {
        // 2. Verificar que el token sea auténtico usando tu clave secreta del .env
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'clave_secreta_temporal');
        
        // 3. Inyectar los datos descifrados directamente en el objeto 'req' para que el controlador los use
        req.usuario = {
            id: decoded.id,
            rol: decoded.rol
        };

        next(); // Le da el pase libre al controlador
    } catch (error) {
        return res.status(403).json({ message: 'Token inválido o expirado.' });
    }
};