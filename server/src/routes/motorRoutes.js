import express from 'express';
import { 
  createMotor, 
  deleteMotor, 
  getMotorById, 
  getMotors, 
  updateMotor 
} from '../controllers/motorController.js';
import { protect, editor } from '../middlewares/authMiddleware.js';
import { upload } from '../config/cloudinary.js'; // <--- IMPORTANTE

const router = express.Router();

router.get('/', protect, getMotors);
router.get('/:id', protect, getMotorById);

router.post('/', protect, editor, upload.array('imagenes'), createMotor);
router.put('/:id', protect, editor, upload.array('imagenes'), updateMotor); 
router.delete('/:id', protect, editor, deleteMotor);

export default router;