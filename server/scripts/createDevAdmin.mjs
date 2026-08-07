import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const users = mongoose.connection.collection('users');
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  await users.updateOne(
    { email: 'admin@bobinados.com' },
    {
      $set: {
        nombre: 'Administrador',
        email: 'admin@bobinados.com',
        password: passwordHash,
        rol: 'super',
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  );

  console.log('DEV_ADMIN_READY');
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
