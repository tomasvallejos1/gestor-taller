import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// 1. Middleware para PROTEGER rutas (Verifica que estés logueado)
export const protect = async (req, res, next) => {
  let token;

  // Verificar si hay un token en el encabezado "Authorization" que empiece con "Bearer"
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Extraer el token (quitamos la palabra "Bearer " del string)
      token = req.headers.authorization.split(' ')[1];

      // Decodificar y verificar el token con la clave secreta
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Buscar el usuario en la base de datos y guardarlo en la petición (req.user)
      // .select('-password') sirve para NO traer la contraseña encriptada por seguridad
      req.user = await User.findById(decoded.id).select('-password');

      next(); // Todo correcto, dejar pasar
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Token no autorizado o expirado' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'No hay token, acceso denegado' });
  }
};

// 2. Middleware para SUPER ADMIN
// Solo permite pasar si el rol es estrictamente 'super'
// Uso: Para crear otros usuarios o borrar datos sensibles
export const admin = (req, res, next) => {
  if (req.user && req.user.rol === 'super') {
    next();
  } else {
    res.status(403).json({ message: 'Acceso denegado. Requiere permisos de Super Administrador (IT).' });
  }
};

// 3. Middleware para EDITOR
// Permite pasar si eres 'super' O 'editor'. BLOQUEA a los que son 'lector'.
// Uso: Para crear, editar o eliminar fichas de motores/reparaciones
export const editor = (req, res, next) => {
  if (req.user && (req.user.rol === 'super' || req.user.rol === 'editor')) {
    next();
  } else {
    res.status(403).json({ message: 'Acceso denegado. Tu perfil es de solo lectura.' });
  }
};