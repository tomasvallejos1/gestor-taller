import mongoose from 'mongoose';
import Counter from './Counter.js'; 

const motorSchema = mongoose.Schema({
  // ID Numérico (1, 2, 3...)
  nroMotor: { type: Number, unique: true }, 

  // --- DATOS TÉCNICOS PUROS (Sin Cliente) ---
  marca: { type: String, required: true, trim: true },
  modelo: { type: String, trim: true },
  hp: { type: String, required: true },
  amperaje: { type: String, trim: true },
  capacitor: { type: String, trim: true },
  tipo: { type: String, default: '' },
  
  // Medidas Físicas
  largoCarcasa: { type: String, trim: true },
  diametroInterior: { type: String, trim: true },
  diametroExterior: { type: String, trim: true },

  // Datos de Bobinado
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

  // Aislaciones
  aislaciones: {
    alta: { type: String, default: '' }, // Se muestra como "Largo" en el front
    ancho: { type: String, default: '' },
    cantidad: { type: String, default: '' }
  },

  // Multimedia y Extras
  fotos: [{ type: String }],
  observaciones: { type: String, default: '' }

}, {
  timestamps: true 
});

// Autoincrement ID
motorSchema.pre('save', async function() {
  const doc = this;
  if (!doc.isNew) return;

  try {
    const counter = await Counter.findByIdAndUpdate(
      { _id: 'motorId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    doc.nroMotor = counter.seq;
  } catch (error) {
    throw error;
  }
});

const Motor = mongoose.model('Motor', motorSchema);
export default Motor;