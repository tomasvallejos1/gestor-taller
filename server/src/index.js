import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import motorRoutes from './routes/motorRoutes.js'; 
import authRoutes from './routes/authRoutes.js';
import cron from 'node-cron'; 
import backupRoutes from './routes/backupRoutes.js'; 
import { sendAutoBackup } from './controllers/backupController.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;

connectDB();

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

// --- ZONA DE RUTAS ---
app.use('/api/motores', motorRoutes);
app.use('/api/auth', authRoutes); 
app.use('/api/backup', backupRoutes);

app.get('/', (req, res) => {
    res.send('API Bobinados David funcionando 🚀');
});

// CRON JOB (Todos los días a las 3:00 AM)
cron.schedule('0 0 3 * * *', () => {
  sendAutoBackup();
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
    console.log(`Accesible en la red local en http://<tu-ip>:${PORT}`);
});