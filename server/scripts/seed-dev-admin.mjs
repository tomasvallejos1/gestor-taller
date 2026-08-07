import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';

dotenv.config();

const email = 'admin@taller.local';
const password = 'Admin123!';

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI no definido en server/.env');
    }

    await mongoose.connect(process.env.MONGO_URI);

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.findOneAndUpdate(
      { email },
      {
        nombre: 'Admin Desarrollo',
        email,
        password: hashedPassword,
        rol: 'super'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('DEV_ADMIN_READY');
    console.log(`EMAIL=${email}`);
    console.log(`PASSWORD=${password}`);
    console.log('ROL=super');
  } catch (error) {
    console.error('DEV_ADMIN_ERROR');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
