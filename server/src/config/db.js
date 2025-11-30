import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Intentamos conectar usando la url guardada en las variables de entorno
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
    console.log(`MongoDB Conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1); // Detener la app si falla la base de datos
  }
};

export default connectDB;