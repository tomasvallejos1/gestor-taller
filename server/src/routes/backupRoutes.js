import express from 'express';
import { downloadBackup } from '../controllers/backupController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Solo Admin descarga
router.get('/download', protect, admin, downloadBackup);

export default router;