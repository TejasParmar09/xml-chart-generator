// adminRoutes.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = mongoose.model('User') || require('../models/User');
const File = mongoose.model('File') || require('../models/File');
const adminAuth = require('../middleware/adminAuth');
const fileController = require('../controllers/FileController'); // Import fileController for delete

// Get all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    console.log('Fetching all users...');
    const users = await User.find().select('-password');
    console.log('Users fetched:', users);
    res.json({ users });
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Get dashboard stats
router.get('/dashboard/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });
    const totalFiles = await File.countDocuments();
    res.json({ totalUsers, activeUsers, totalFiles });
  } catch (err) {
    console.error('Error fetching stats:', err.message);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// Get admin profile
router.get('/profile', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      name: user.name,
      email: user.email,
      birthday: user.birthday || '',
      mobile: user.mobile || '',
      address: user.address || '',
      profilePicture: user.profilePicture || '',
    });
  } catch (err) {
    console.error('Error fetching admin profile:', err.message);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// Update admin profile
router.put('/profile', adminAuth, async (req, res) => {
  try {
    const { name, mobile, address, birthday } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, mobile, address, birthday },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      name: user.name,
      email: user.email,
      birthday: user.birthday || '',
      mobile: user.mobile || '',
      address: user.address || '',
      profilePicture: user.profilePicture || '',
    });
  } catch (err) {
    console.error('Error updating admin profile:', err.message);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Get files by user (Admin can view any user's files)
router.get('/user-files/:userId', adminAuth, async (req, res) => {
  try {
    const files = await File.find({ uploadedBy: req.params.userId });
    res.json({ files });
  } catch (err) {
    console.error('Error fetching user files (admin):', err.message);
    res.status(500).json({ message: 'Failed to fetch user files' });
  }
});

// Get file by ID (Admin can view any file by ID)
router.get('/files/:fileId', adminAuth, async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) return res.status(404).json({ message: 'File not found' });
    res.json(file);
  } catch (err) {
    console.error('Error fetching file (admin):', err.message);
    res.status(500).json({ message: 'Failed to fetch file' });
  }
});

// Get file content (Admin can view content of any file by ID)
router.get('/files/:fileId/content', adminAuth, async (req, res) => {
  try {
    const fileId = req.params.fileId;
    console.log(`Attempting to fetch content for file ID: ${fileId}`);
    const file = await File.findById(fileId);
    console.log('File document found:', file);

    if (!file) {
      console.warn(`File not found for ID: ${fileId}`);
      return res.status(404).json({ message: 'File not found' });
    }

    const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
    if (!file.gridfsId) {
      console.error(`File document for ID ${file._id} has no gridfsId.`);
      return res.status(500).json({ error: 'File content not available (missing GridFS ID).' });
    }
    const downloadStream = gfs.openDownloadStream(file.gridfsId);

    let data = '';
    downloadStream.on('data', (chunk) => (data += chunk.toString()));
    downloadStream.on('end', () => {
      console.log(`Successfully fetched content for file ID: ${fileId}`);
      res.json({ data });
    });
    downloadStream.on('error', (err) => {
      console.error(`Error streaming file content for ID ${fileId} (admin):`, err);
      res.status(500).json({ message: 'Failed to fetch file content due to streaming error.' });
    });

  } catch (err) {
    console.error(`Server error fetching file content for ID ${req.params.fileId} (admin):`, err);
    res.status(500).json({ message: 'Server error fetching file content.' });
  }
});

// Delete file (Admin can delete any file by ID)
router.delete('/files/:fileId', adminAuth, async (req, res) => {
  try {
    const fileId = req.params.fileId;
    console.log('Attempting to delete file with ID:', fileId);
    const file = await File.findById(fileId);
    if (!file) {
      console.warn('File not found for deletion:', fileId);
      return res.status(404).json({ message: 'File not found' });
    }

    if (file.gridfsId) {
      const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
      // Delete from GridFS and then the document
      try {
        await new Promise((resolve) => {
          gfs.delete(file.gridfsId, (err) => {
            if (err) {
              console.error(`Warning: Error deleting file ${file.gridfsId} from GridFS (admin):`, err);
              // Log the error but do NOT reject the promise.
              // Proceed to delete the document even if GridFS deletion failed.
            }
            resolve(); // Always resolve the promise so document deletion proceeds.
          });
        });
        // After attempting GridFS deletion (regardless of success), delete the document
        await fileController.deleteFileDocument(fileId);
        console.log(`File document and GridFS entry (if found) deleted for ID: ${fileId}`);
        res.status(200).json({ message: 'File deleted successfully' });
      } catch (err) {
        console.error(`Error during file document deletion for ID ${fileId} (admin):`, err);
        // If document deletion fails, return server error
        res.status(500).json({ message: 'Failed to delete file document.', details: err.message });
      }
    } else {
      console.warn(`File ${fileId} has no gridfsId. Deleting document only.`);
      await fileController.deleteFileDocument(fileId);
      res.status(200).json({ message: 'File deleted successfully (no GridFS entry found). Missing GridFS ID.' });
    }

  } catch (err) {
    console.error(`Error deleting file ${req.params.fileId} (admin):`, err);
    res.status(500).json({ message: 'Failed to delete file', details: err.message });
  }
});

// Get recent users (Admin)
router.get('/recent-users', adminAuth, async (req, res) => {
  try {
    // Fetch the latest 5 users, excluding password, sorted by creation date
    const recentUsers = await User.find().select('-password').sort({ createdAt: -1 }).limit(5);
    res.json({ users: recentUsers });
  } catch (err) {
    console.error('Error fetching recent users (admin):', err.message);
    res.status(500).json({ message: 'Failed to fetch recent users' });
  }
});

// Get recent files (Admin)
router.get('/recent-files', adminAuth, async (req, res) => {
  try {
    // Fetch the latest 5 files, sorted by creation date
    const recentFiles = await File.find().populate('uploadedBy', 'name email').sort({ createdAt: -1 }).limit(5);
    res.json({ files: recentFiles });
  } catch (err) {
    console.error('Error fetching recent files (admin):', err.message);
    res.status(500).json({ message: 'Failed to fetch recent files' });
  }
});

// Get user registration trends (Admin)
router.get('/registration-trends', adminAuth, async (req, res) => {
  try {
    // Aggregate user registrations by day (example for the last 30 days)
    const trends = await User.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({ trends });
  } catch (err) {
    console.error('Error fetching registration trends (admin):', err.message);
    res.status(500).json({ message: 'Failed to fetch registration trends' });
  }
});

// Get file type distribution (Admin)
router.get('/file-type-distribution', adminAuth, async (req, res) => {
  try {
    // Aggregate file counts by file extension
    const distribution = await File.aggregate([
      { $group: { _id: { $toLower: { $substrCP: ["$filename", { $add: [{ $strLenCP: "$filename" }, -3] }, { $strLenCP: "$filename" }] } }, count: { $sum: 1 } } }, // Basic attempt to get last 3 chars as extension
       { $sort: { count: -1 } }
    ]);
    res.json({ distribution });
  } catch (err) {
    console.error('Error fetching file type distribution (admin):', err.message);
    res.status(500).json({ message: 'Failed to fetch file type distribution' });
  }
});

module.exports = router;