import express from 'express';
import { 
  createMotor, 
  deleteMotor, 
  getMotorById, 
  getMotors, 
  updateMotor 
} from '../controllers/motorController.js';

const router = express.Router();

// Definimos las rutas base
// GET /api/motores -> Obtiene todos
// POST /api/motores -> Crea uno nuevo
router.route('/')
  .get(getMotors)
  .post(createMotor);

// Definimos las rutas que necesitan ID
// GET /api/motores/:id -> Obtiene uno especifico
// PUT /api/motores/:id -> Actualiza
// DELETE /api/motores/:id -> Elimina
router.route('/:id')
  .get(getMotorById)
  .put(updateMotor)
  .delete(deleteMotor);

export default router;