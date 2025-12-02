import mongoose from 'mongoose';
import Counter from './Counter.js'; 

const motorSchema = mongoose.Schema({
  // CAMBIO AQUÍ: De nroOrden a nroMotor
  nroMotor: { type: Number, unique: true }, 

  // Datos Generales
  cliente: { type: String, default: "Cliente General" },
  marca: { type: String, required: true, trim: true },
  modelo: { type: String, trim: true },
  hp: { type: String, required: true },
  amperaje: { type: String, trim: true },
  capacitor: { type: String, trim: true },
  tipo: { type: String, default: '' },
  largoCarcasa: { type: String, trim: true },
  diametroInterior: { type: String, trim: true },
  diametroExterior: { type: String, trim: true },

  // Bobinados
  arranque: {
    alambre: { type: String, default: '' },
    paso: { type: String, default: '' },
    vueltas: { type: String, default: '' },
    abertura: { type: String, default: '' }
  },
  trabajo: {
    alambre: { type: String, default: '' },
    paso: { type: String, default: '' },
    vueltas: { type: String, default: '' },
    abertura: { type: String, default: '' }
  },

  // Aislaciones y Obs
  aislaciones: {
    alta: { type: String, default: '' },
    ancho: { type: String, default: '' },
    cantidad: { type: String, default: '' }
  },
  fotos: [{ type: String }],
  observaciones: { type: String, default: '' }
}, {
  timestamps: true 
});

motorSchema.pre('save', async function() {
  const doc = this;
  if (!doc.isNew) return;

  try {
    const counter = await Counter.findByIdAndUpdate(
      { _id: 'motorId' }, // Usamos el contador de ID de Motores
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    // CAMBIO AQUÍ: Asignamos a nroMotor
    doc.nroMotor = counter.seq;
    
  } catch (error) {
    throw error;
  }
});

const Motor = mongoose.model('Motor', motorSchema);
export default Motor;