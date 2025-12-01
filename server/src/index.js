import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import motorRoutes from './routes/motorRoutes.js'; 

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;

connectDB();

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

// --- ZONA DE RUTAS ---
app.use('/api/motores', motorRoutes); 

app.get('/', (req, res) => {
    res.send('API Bobinados David funcionando 🚀');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
    console.log(`Accesible en la red local en http://<tu-ip>:${PORT}`);
});