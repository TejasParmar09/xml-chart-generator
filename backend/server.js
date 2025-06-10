require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const path = require('path');
const { GridFSBucket } = require('mongodb');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const adminRoutes = require('./routes/admin');
const File = require('./models/File');

const app = express();

// Configure CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/chart-generator' }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// --- Global Error Handlers --- //
// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optionally, log to a file or send to an error tracking service
  // process.exit(1); // Exit with a failure code if critical
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Optionally, log to a file or send to an error tracking service
  // process.exit(1); // Exit with a failure code if critical
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
    try {
      global.bucket = new GridFSBucket(conn.connection.db, { bucketName: 'uploads' });
      console.log('GridFSBucket initialized successfully');
    } catch (err) {
      console.error('Error initializing GridFSBucket:', err);
    }

    // Clean up invalid files
    console.log('Starting database cleanup...');
    try {
      const invalidFiles = await File.deleteMany({
        $or: [
          { gridfsId: { $exists: false } },
          { gridfsId: { $not: { $type: 'objectId' } } }
        ]
      });
      console.log(`Deleted ${invalidFiles.deletedCount} invalid file documents`);
      console.log('Database cleanup completed successfully');
    } catch (err) {
      console.error('Error during database cleanup:', err);
    }
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Test route
app.get('/api/test', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));