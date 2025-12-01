import Motor from '../models/Motor.js';
import mongoose from 'mongoose';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const getMotors = async (req, res) => {
  try {
    // Ordenamos por nroOrden descendente (los nuevos primero)
    const motores = await Motor.find().sort({ nroOrden: -1 }); 
    res.json(motores);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMotorById = async (req, res) => {
  const { id } = req.params;
  try {
    let motor;
    
    // INTELIGENCIA DE BÚSQUEDA:
    // 1. Si es un número (ej: "1"), busca por nroOrden
    if (!isNaN(id)) {
      motor = await Motor.findOne({ nroOrden: id });
    } 
    // 2. Si es un hash largo y válido, busca por _id (mongo ID)
    else if (isValidObjectId(id)) {
      motor = await Motor.findById(id);
    }

    if (!motor) return res.status(404).json({ message: 'Motor no encontrado' });
    res.json(motor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createMotor = async (req, res) => {
  try {
    const nuevoMotor = new Motor(req.body);
    const motorGuardado = await nuevoMotor.save();
    res.status(201).json(motorGuardado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateMotor = async (req, res) => {
  const { id } = req.params;
  try {
    // Misma lógica: si es número busca por orden, si no por ID
    let query = !isNaN(id) ? { nroOrden: id } : { _id: id };
    
    const motorActualizado = await Motor.findOneAndUpdate(query, req.body, { new: true });
    if (!motorActualizado) return res.status(404).json({ message: 'Motor no encontrado' });
    res.json(motorActualizado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteMotor = async (req, res) => {
  const { id } = req.params;
  try {
    let query = !isNaN(id) ? { nroOrden: id } : { _id: id };
    
    const motorEliminado = await Motor.findOneAndDelete(query);
    if (!motorEliminado) return res.status(404).json({ message: 'Motor no encontrado' });
    res.json({ message: 'Motor eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};