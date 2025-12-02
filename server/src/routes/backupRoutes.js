import express from 'express';
import { downloadBackup, testEmailBackup } from '../controllers/backupController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Descarga directa
router.get('/download', protect, admin, downloadBackup);

// Probar envío de mail (Nuevo)
router.post('/test-email', protect, admin, testEmailBackup);

export default router;