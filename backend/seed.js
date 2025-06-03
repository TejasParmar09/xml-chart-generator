// seed.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Adjust the path based on your project structure

const MONGO_URI = 'mongodb://localhost:27017/chart-generator'; // Change your DB name

const seedAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const existingAdmin = await User.findOne({ email: 'admin@gmail.com' });
    if (existingAdmin) {
      console.log('Admin already exists:', existingAdmin.email);
      return process.exit(0);
    }

    const hashedPassword = await bcrypt.hash('admin123', 10); // default password

    const adminUser = new User({
      name: 'Admin',
      email: 'admin@gmail.com',
      password: 'admin123',
      role: 'admin',
    });

    await adminUser.save();
    console.log('✅ Admin user seeded successfully!');
  } catch (err) {
    console.error('❌ Failed to seed admin:', err);
  } finally {
    mongoose.disconnect();
  }
};

seedAdmin();
