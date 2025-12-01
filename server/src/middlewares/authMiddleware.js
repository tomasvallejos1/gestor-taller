import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// 1. Proteger: Verifica que el usuario esté logueado
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Extraer el token ("Bearer ag8s7dg8s7d...")
      token = req.headers.authorization.split(' ')[1];
      
      // Decodificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Buscar usuario y guardarlo en la petición (sin el password)
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      res.status(401).json({ message: 'Token no autorizado' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'No hay token, acceso denegado' });
  }
};

// 2. Admin: Verifica que el usuario sea 'super'
export const admin = (req, res, next) => {
  if (req.user && req.user.rol === 'super') {
    next();
  } else {
    res.status(403).json({ message: 'Acceso denegado. Requiere permisos de Administrador.' });
  }
};