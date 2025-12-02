import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- FUNCIÓN CORREGIDA ---
const getDataDump = async () => {
  // Accedemos a las colecciones crudas de la base de datos
  const collections = mongoose.connection.collections;
  const dump = {};

  for (const key in collections) {
    const collection = collections[key];
    
    // CAMBIO AQUÍ: Usamos .find().toArray() en lugar de .lean()
    // Esto funciona directamente con el driver de MongoDB
    const data = await collection.find({}).toArray();
    
    dump[key] = data;
  }
  return dump;
};

// 1. DESCARGA MANUAL
export const downloadBackup = async (req, res) => {
  try {
    console.log("📥 Iniciando descarga manual de backup...");
    const data = await getDataDump();
    const date = new Date().toISOString().split('T')[0];
    const fileName = `backup-taller-${date}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    
    res.send(JSON.stringify(data, null, 2));
    console.log("✅ Backup enviado al navegador.");

  } catch (error) {
    console.error("❌ Error descarga manual:", error);
    res.status(500).json({ message: 'Error generando backup: ' + error.message });
  }
};

// 2. BACKUP POR EMAIL (Interno)
export const sendAutoBackup = async () => {
  try {
    console.log('📧 Iniciando proceso de Backup por Email...');
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("Faltan credenciales de email en .env");
    }

    const data = await getDataDump();
    const date = new Date().toISOString().split('T')[0];
    const fileName = `backup-auto-${date}.json`;
    
    // Usamos /tmp para compatibilidad con nubes (Render)
    const tempDir = path.join(__dirname, '../../tmp');
    if (!fs.existsSync(tempDir)){
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const filePath = path.join(tempDir, fileName);
    
    console.log(`📝 Escribiendo archivo temporal en: ${filePath}`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    console.log(`📤 Enviando correo a ${process.env.EMAIL_USER}...`);
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, 
      subject: `📦 Backup Base de Datos - ${date}`,
      html: `
        <h3>Copia de Seguridad Automática</h3>
        <p>Fecha: ${new Date().toLocaleString()}</p>
        <p>Adjunto encontrarás el archivo JSON con todos los datos del sistema.</p>
      `,
      attachments: [{ filename: fileName, path: filePath }]
    });

    console.log('✅ Correo enviado con éxito.');
    fs.unlinkSync(filePath); // Limpiar archivo temporal

    return { success: true };

  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return { success: false, error: error.message };
  }
};

// 3. TEST DE EMAIL
export const testEmailBackup = async (req, res) => {
    const result = await sendAutoBackup();
    if (result.success) {
        res.json({ message: "Backup enviado correctamente a tu correo." });
    } else {
        res.status(500).json({ message: "Error enviando correo: " + result.error });
    }
};