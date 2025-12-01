import mongoose from 'mongoose';

const userSchema = mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  rol: { 
    type: String, 
    enum: ['super', 'editor', 'lector'], // super=Admin IT, editor=Técnico, lector=Solo ver
    default: 'editor' 
  },
  resetToken: String, // Para el código de recuperación
  resetTokenExpire: Date
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);
export default User;