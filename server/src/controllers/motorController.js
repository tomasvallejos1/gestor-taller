import Motor from '../models/Motor.js';
import mongoose from 'mongoose';

// Función auxiliar para validar ID de Mongo
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// 1. Obtener todos los motores
export const getMotors = async (req, res) => {
  try {
    const motores = await Motor.find().sort({ nroOrden: -1 });
    res.json(motores);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Obtener un motor por ID o NroOrden
export const getMotorById = async (req, res) => {
  const { id } = req.params;
  try {
    let motor;
    
    if (!isNaN(id)) {
      motor = await Motor.findOne({ nroOrden: id });
    } else if (isValidObjectId(id)) {
      motor = await Motor.findById(id);
    }

    if (!motor) return res.status(404).json({ message: 'Motor no encontrado' });
    res.json(motor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Crear un nuevo motor (Soporte FOTOS)
export const createMotor = async (req, res) => {
  try {
    console.log("--- CREANDO MOTOR ---");
    let datosMotor = {};

    // Si vienen archivos, los datos de texto vienen en req.body.data como string JSON
    // Si no, vienen directos en req.body
    if (req.body.data) {
        datosMotor = JSON.parse(req.body.data);
    } else {
        datosMotor = req.body;
    }
    
    // Si hay fotos subidas, Cloudinary nos da las URLs en req.files
    if (req.files && req.files.length > 0) {
      const urls = req.files.map(file => file.path);
      datosMotor.fotos = urls;
    }

    const nuevoMotor = new Motor(datosMotor);
    const motorGuardado = await nuevoMotor.save();
    res.status(201).json(motorGuardado);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

// 4. Actualizar motor (Soporte FOTOS)
export const updateMotor = async (req, res) => {
  const { id } = req.params;
  try {
    console.log(`--- ACTUALIZANDO MOTOR ${id} ---`);
    
    let datosActualizados = {};

    // Parsear datos si vienen como string (FormData)
    if (req.body.data) {
        datosActualizados = JSON.parse(req.body.data);
    } else {
        datosActualizados = req.body || {};
    }

    // Agregar fotos nuevas a las existentes
    if (req.files && req.files.length > 0) {
      const nuevasFotos = req.files.map(file => file.path);
      // Combinamos: Fotos viejas (que vienen en el JSON) + Nuevas
      datosActualizados.fotos = [...(datosActualizados.fotos || []), ...nuevasFotos];
    }

    // Buscar por NroOrden o ID
    let query = !isNaN(id) ? { nroOrden: id } : { _id: id };

    const motor = await Motor.findOneAndUpdate(query, datosActualizados, { new: true });
    
    if (!motor) return res.status(404).json({ message: 'Motor no encontrado' });
    res.json(motor);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

// 5. Eliminar motor
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