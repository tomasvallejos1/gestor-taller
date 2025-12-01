import express from 'express';
import { 
  loginUser, 
  registerUser, 
  forgotPassword, 
  updateProfile, 
  getUsers,      
  deleteUser,
  updateUserById     
} from '../controllers/authController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Rutas Públicas
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);

// Rutas Privadas (Cualquier usuario logueado)
router.put('/profile', protect, updateProfile);

// Rutas de Administración (Solo Super Admin)
router.post('/register', protect, admin, registerUser); // Crear usuario
router.get('/users', protect, admin, getUsers);         // Listar usuarios
router.delete('/users/:id', protect, admin, deleteUser); // Eliminar usuario
router.put('/users/:id', protect, admin, updateUserById); //Editar usuario

export default router;