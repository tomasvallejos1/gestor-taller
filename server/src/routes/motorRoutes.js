import express from 'express';
import { 
  createMotor, 
  deleteMotor, 
  getMotorById, 
  getMotors, 
  updateMotor 
} from '../controllers/motorController.js'; // <--- Verifica que importe desde controllers

const router = express.Router();

// La ruta '/' equivale a '/api/motores' gracias al index.js
router.route('/')
  .get(getMotors)
  .post(createMotor); // <--- Esto maneja el CREAR (POST)

router.route('/:id')
  .get(getMotorById)
  .put(updateMotor)
  .delete(deleteMotor);

export default router;