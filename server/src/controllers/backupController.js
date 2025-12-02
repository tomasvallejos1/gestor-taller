import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Obtener toda la data de la DB
const getDataDump = async () => {
  const collections = mongoose.connection.collections;
  const dump = {};
  for (const key in collections) {
    const model = collections[key];
    // Usamos find().lean() para que sea JSON puro y rápido
    const data = await model.find({}).lean(); 
    dump[key] = data;
  }
  return dump;
};

// 1. Descarga Manual
export const downloadBackup = async (req, res) => {
  try {
    const data = await getDataDump();
    const date = new Date().toISOString().split('T')[0];
    const fileName = `backup-taller-${date}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error generando backup' });
  }
};

// 2. Envío Automático
export const sendAutoBackup = async () => {
  try {
    console.log('⏳ Iniciando Backup Automático...');
    const data = await getDataDump();
    const date = new Date().toISOString().split('T')[0];
    const fileName = `backup-auto-${date}.json`;
    
    const filePath = path.join(__dirname, `../../${fileName}`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, 
      subject: `📦 Respaldo Base de Datos - ${date}`,
      text: 'Adjunto copia de seguridad diaria.',
      attachments: [{ filename: fileName, path: filePath }]
    });

    console.log('✅ Backup enviado por email.');
    fs.unlinkSync(filePath); // Borrar archivo temporal

  } catch (error) {
    console.error('❌ Error backup automático:', error);
  }
};