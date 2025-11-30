import mongoose from 'mongoose';

const motorSchema = mongoose.Schema({
  // 1. Datos Generales (Cabecera de la ficha)
  tipo: { // En tu imagen dice "Motor: Bomba Sumergible"
    type: String,
    trim: true,
    default: ''
  },
  marca: {
    type: String,
    required: true,
    trim: true
  },
  modelo: {
    type: String,
    trim: true
  },
  hp: {
    type: String,
    required: true
  },
  amperaje: { // "Amp"
    type: String,
    trim: true
  },
  capacitor: {
    type: String,
    trim: true
  },
  largoCarcasa: {
    type: String,
    trim: true
  },
  diametroInterior: { // "Ø Interior"
    type: String,
    trim: true
  },
  diametroExterior: { // "Ø Exterior"
    type: String,
    trim: true
  },

  // 2. Sección Arranque (Agrupamos los datos para orden)
  arranque: {
    alambre: { type: String, default: '' },
    paso: { type: String, default: '' },
    vueltas: { type: String, default: '' },
    abertura: { type: String, default: '' } // "Ranura Completa", etc.
  },

  // 3. Sección Trabajo
  trabajo: {
    alambre: { type: String, default: '' },
    paso: { type: String, default: '' },
    vueltas: { type: String, default: '' },
    abertura: { type: String, default: '' }
  },

  // 4. Sección Aislaciones (Lo nuevo que pediste)
  aislaciones: {
    alta: { type: String, default: '' },
    ancho: { type: String, default: '' },
    cantidad: { type: String, default: '' }
  },

  // 5. Pie de página
  observaciones: {
    type: String,
    default: ''
  },
  
  // Agregamos fecha automática de creación y actualización
}, {
  timestamps: true 
});

const Motor = mongoose.model('Motor', motorSchema);

export default Motor;