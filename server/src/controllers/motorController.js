import Motor from '../models/Motor.js';
import mongoose from 'mongoose';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// 1. Obtener todos
export const getMotors = async (req, res) => {
  try {
    // CAMBIO: Ordenar por nroMotor
    const motores = await Motor.find().sort({ nroMotor: -1 });
    res.json(motores);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Obtener UNO
export const getMotorById = async (req, res) => {
  const { id } = req.params;
  try {
    let motor;
    
    // CAMBIO: Buscar por nroMotor
    if (!isNaN(id)) {
      motor = await Motor.findOne({ nroMotor: id });
    } else if (isValidObjectId(id)) {
      motor = await Motor.findById(id);
    }

    if (!motor) return res.status(404).json({ message: 'Motor no encontrado' });
    res.json(motor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Crear
export const createMotor = async (req, res) => {
  try {
    let datosMotor = {};
    if (req.body.data) {
        datosMotor = JSON.parse(req.body.data);
    } else {
        datosMotor = req.body;
    }
    
    if (req.files && req.files.length > 0) {
      const urls = req.files.map(file => file.path);
      datosMotor.fotos = urls;
    }

    const nuevoMotor = new Motor(datosMotor);
    const motorGuardado = await nuevoMotor.save();
    res.status(201).json(motorGuardado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 4. Actualizar
export const updateMotor = async (req, res) => {
  const { id } = req.params;
  try {
    let datosActualizados = {};
    if (req.body.data) {
        datosActualizados = JSON.parse(req.body.data);
    } else {
        datosActualizados = req.body || {};
    }

    if (req.files && req.files.length > 0) {
      const nuevasFotos = req.files.map(file => file.path);
      const fotosViejas = datosActualizados.fotos || [];
      datosActualizados.fotos = [...fotosViejas, ...nuevasFotos];
    }

    // CAMBIO: Query por nroMotor
    let query = !isNaN(id) ? { nroMotor: id } : { _id: id };

    const motor = await Motor.findOneAndUpdate(query, datosActualizados, { new: true });
    
    if (!motor) return res.status(404).json({ message: 'Motor no encontrado' });
    res.json(motor);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 5. Eliminar
export const deleteMotor = async (req, res) => {
  const { id } = req.params;
  try {
    // CAMBIO: Query por nroMotor
    let query = !isNaN(id) ? { nroMotor: id } : { _id: id };
    
    const motorEliminado = await Motor.findOneAndDelete(query);
    if (!motorEliminado) return res.status(404).json({ message: 'Motor no encontrado' });
    res.json({ message: 'Motor eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};