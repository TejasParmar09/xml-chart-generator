const express = require('express');
const router = express.Router();
const multer = require('multer');
const xml2js = require('xml2js');
const authMiddleware = require('../middleware/auth');
const fileController = require('../controllers/FileController');
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const File = require('../models/File');

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/xml' || file.originalname.toLowerCase().endsWith('.xml')) {
      cb(null, true);
    } else {
      cb(new Error('Only XML files are allowed'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// File upload route
router.post('/upload', authMiddleware.auth, upload.single('file'), async (req, res) => {
  console.log('POST /api/files/upload route hit');
  try {
    if (!req.file) {
      console.warn('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    console.log('File received:', {
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      bufferLength: req.file.buffer?.length
    });

    if (!global.bucket) {
      console.error('GridFSBucket not initialized');
      return res.status(500).json({ error: 'Server not configured for file uploads' });
    }

    // Upload to GridFS
    let gridfsId;
    try {
      gridfsId = await new Promise((resolve, reject) => {
        const uploadStream = global.bucket.openUploadStream(req.file.originalname);
        console.log(`Upload stream opened with ID: ${uploadStream.id}`);
        if (!(uploadStream.id instanceof mongoose.Types.ObjectId)) {
          return reject(new Error(`Invalid gridfsId type: ${typeof uploadStream.id}`));
        }
        const id = uploadStream.id;
        uploadStream.write(req.file.buffer);
        uploadStream.end();
        uploadStream.on('finish', () => {
          console.log(`GridFS upload completed: ${id}`);
          resolve(id);
        });
        uploadStream.on('error', err => {
          console.error('GridFS upload error:', err);
          reject(err);
        });
      });

      // Verify GridFS file exists
      const gridfsFile = await mongoose.connection.db.collection('uploads.files').findOne({ _id: gridfsId });
      if (!gridfsFile) {
        console.error(`GridFS file not found for ID: ${gridfsId}`);
        await global.bucket.delete(gridfsId).catch(err => console.error('Cleanup error:', err));
        return res.status(500).json({ error: 'Failed to verify GridFS file' });
      }
    } catch (err) {
      console.error('Failed to upload to GridFS:', err);
      return res.status(500).json({ error: 'Failed to upload file to storage' });
    }

    // Save to database
    try {
      const savedFile = await fileController.saveFileToDb({
        filename: req.file.originalname,
        gridfsId,
        size: req.file.size,
        contentType: req.file.mimetype,
        uploadedBy: req.user._id
      });
      console.log('File saved to DB:', savedFile);
      res.status(201).json({
        file: {
          id: savedFile._id.toString(),
          name: savedFile.filename,
          size: savedFile.size,
          uploadDate: savedFile.uploadDate,
          gridfsId: savedFile.gridfsId.toString()
        },
        message: 'File uploaded successfully'
      });
    } catch (dbErr) {
      console.error('Error saving file to DB:', dbErr);
      await global.bucket.delete(gridfsId).catch(err => console.error('Cleanup error:', err));
      return res.status(500).json({ error: 'Failed to save file metadata' });
    }
  } catch (err) {
    console.error('Unexpected error in upload:', err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get all files for the authenticated user
router.get('/', authMiddleware.auth, async (req, res) => {
  console.log('GET /api/files route hit');
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const files = await File.find({ uploadedBy: userId }).select('filename size uploadDate gridfsId');
    console.log(`Found ${files.length} files for user: ${userId}`);

    const validFiles = files
      .filter(file => {
        if (!file.gridfsId || !/^[0-9a-fA-F]{24}$/.test(file.gridfsId.toString())) {
          console.warn(`Skipping file ${file.filename} (ID: ${file._id}) due to missing or invalid gridfsId`);
          File.deleteOne({ _id: file._id }).catch(err => console.error(`Error deleting invalid file ${file._id}:`, err));
          return false;
        }
        return true;
      })
      .map(file => ({
        id: file._id.toString(),
        name: file.filename,
        size: file.size,
        uploadDate: file.uploadDate,
        gridfsId: file.gridfsId.toString()
      }));

    res.status(200).json({ files: validFiles });
  } catch (err) {
    console.error('Error fetching files:', err);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Get file details by MongoDB _id
router.get('/:id', authMiddleware.auth, async (req, res) => {
  console.log(`GET /api/files/:id route hit with id: ${req.params.id}`);
  try {
    const file = await fileController.getFileById(req.params.id, req.user._id);
    if (!file) {
      console.warn(`File not found for id: ${req.params.id}`);
      return res.status(404).json({ error: 'File not found' });
    }
    if (!file.gridfsId || !/^[0-9a-fA-F]{24}$/.test(file.gridfsId.toString())) {
      console.warn(`File ${file.filename} (ID: ${file._id}) missing or invalid gridfsId`);
      await File.deleteOne({ _id: file._id });
      return res.status(500).json({ error: 'Invalid file: missing or invalid GridFS ID' });
    }
    res.json({
      id: file._id.toString(),
      name: file.filename,
      size: file.size,
      uploadDate: file.uploadDate,
      gridfsId: file.gridfsId.toString()
    });
  } catch (err) {
    console.error('Error fetching file:', err);
    res.status(500).json({ error: 'Failed to fetch file details' });
  }
});

// Get file content (parsed XML) using GridFS by gridfsId
router.get('/content/:gridfsId', authMiddleware.auth, async (req, res) => {
  const { gridfsId } = req.params;
  console.log(`GET /api/files/content/:gridfsId route hit with gridfsId: ${gridfsId}`);
  try {
    const fileObjectId = new ObjectId(gridfsId);
    const file = await File.findOne({ gridfsId: fileObjectId, uploadedBy: req.user._id });
    if (!file) {
      console.warn(`File not found for gridfsId: ${gridfsId}`);
      return res.status(404).json({ message: 'File not found or access denied' });
    }

    const downloadStream = global.bucket.openDownloadStream(file.gridfsId);
    let fileData = '';
    downloadStream.on('data', chunk => fileData += chunk.toString('utf8'));
    downloadStream.on('end', async () => {
      try {
        const parsedData = await xml2js.parseStringPromise(fileData);
        res.json({ data: parsedData });
      } catch (parseErr) {
        console.error('Error parsing XML:', parseErr);
        res.status(500).json({ message: 'Failed to parse XML content' });
      }
    });
    downloadStream.on('error', err => {
      console.error('GridFS download error:', err);
      res.status(500).json({ message: 'Error retrieving file content' });
    });
  } catch (error) {
    console.error('Error fetching file content:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Download file using GridFS by gridfsId
router.get('/download/:gridfsId', authMiddleware.auth, async (req, res) => {
  const { gridfsId } = req.params;
  console.log(`GET /api/files/download/:gridfsId route hit with gridfsId: ${gridfsId}`);
  try {
    const fileObjectId = new ObjectId(gridfsId);
    const file = await File.findOne({ gridfsId: fileObjectId, uploadedBy: req.user._id });
    if (!file) {
      console.warn(`File not found for gridfsId: ${gridfsId}`);
      return res.status(404).json({ message: 'File not found or access denied' });
    }

    res.setHeader('Content-Type', file.contentType || 'text/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    const downloadStream = global.bucket.openDownloadStream(file.gridfsId);
    downloadStream.pipe(res);
    downloadStream.on('error', err => {
      console.error('Download stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error downloading file' });
      }
    });
  } catch (error) {
    console.error('Error processing download:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete file and its content from GridFS by gridfsId
router.delete('/:gridfsId', authMiddleware.auth, async (req, res) => {
  const { gridfsId } = req.params;
  console.log(`DELETE /api/files/:gridfsId route hit with gridfsId: ${gridfsId}`);
  try {
    const fileObjectId = new ObjectId(gridfsId);
    const file = await File.findOne({ gridfsId: fileObjectId, uploadedBy: req.user._id });
    if (!file) {
      console.warn(`File not found for gridfsId: ${gridfsId}`);
      return res.status(404).json({ message: 'File not found or access denied' });
    }

    await global.bucket.delete(file.gridfsId).catch(err => {
      console.error('Error deleting GridFS file:', err);
      throw err;
    });
    await fileController.deleteFileDocument(file._id);
    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error during file deletion:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;