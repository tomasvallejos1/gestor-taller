import mongoose from 'mongoose';
import Counter from './Counter.js'; // Importamos el contador

const motorSchema = mongoose.Schema({
  nroOrden: { type: Number, unique: true }, 

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

  // Si no es nuevo, terminamos aquí
  if (!doc.isNew) return;

  try {
    const counter = await Counter.findByIdAndUpdate(
      { _id: 'motorId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    doc.nroOrden = counter.seq;
    
  } catch (error) {
    throw error;
  }
});

const Motor = mongoose.model('Motor', motorSchema);
export default Motor;