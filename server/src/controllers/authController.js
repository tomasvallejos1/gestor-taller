import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

// Generar Token (Dura 30 días)
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// 1. LOGIN
export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    
    // Verificar si existe y si la contraseña coincide
    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user._id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. REGISTRAR USUARIO (Solo Admin)
export const registerUser = async (req, res) => {
  const { nombre, email, password, rol } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'El usuario ya existe' });

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      nombre, email, password: hashedPassword, rol
    });

    if (user) {
      res.status(201).json({
        _id: user._id, nombre: user.nombre, email: user.email, rol: user.rol
      });
    } else {
      res.status(400).json({ message: 'Datos inválidos' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. OLVIDÉ CONTRASEÑA
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Generar código de 6 dígitos
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    user.resetToken = resetCode;
    user.resetTokenExpire = Date.now() + 3600000; // 1 hora
    await user.save();

    // Enviar correo
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Recuperación de Clave - Bobinados David',
      text: `Tu código de recuperación es: ${resetCode}`
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Correo enviado con éxito' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al enviar correo. Verifica credenciales.' });
  }
};