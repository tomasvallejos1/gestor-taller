import Motor from '../models/Motor.js';

// 1. Obtener todos los motores
export const getMotors = async (req, res) => {
  try {
    const motores = await Motor.find().sort({ createdAt: -1 }); // Los más nuevos primero
    res.json(motores);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Obtener un motor por su ID (para ver la ficha completa)
export const getMotorById = async (req, res) => {
  try {
    const motor = await Motor.findById(req.params.id);
    if (!motor) return res.status(404).json({ message: 'Motor no encontrado' });
    res.json(motor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Crear un nuevo motor
export const createMotor = async (req, res) => {
  try {
    // req.body contiene todos los datos que enviaremos desde el formulario
    const nuevoMotor = new Motor(req.body);
    const motorGuardado = await nuevoMotor.save();
    res.status(201).json(motorGuardado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 4. Actualizar un motor existente
export const updateMotor = async (req, res) => {
  try {
    const motorActualizado = await Motor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true } // Esto devuelve el dato ya actualizado
    );
    if (!motorActualizado) return res.status(404).json({ message: 'Motor no encontrado' });
    res.json(motorActualizado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 5. Eliminar un motor
export const deleteMotor = async (req, res) => {
  try {
    const motorEliminado = await Motor.findByIdAndDelete(req.params.id);
    if (!motorEliminado) return res.status(404).json({ message: 'Motor no encontrado' });
    res.json({ message: 'Motor eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};