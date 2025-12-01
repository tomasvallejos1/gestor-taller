import express from 'express';
import { loginUser, registerUser, forgotPassword } from '../controllers/authController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);

// Solo el ADMIN logueado puede crear nuevos usuarios
router.post('/register', protect, admin, registerUser);

export default router;