const mongoose = require('mongoose');
const File = require('../models/File');

exports.saveFileToDb = async ({ filename, gridfsId, size, contentType, uploadedBy }) => {
  console.log('Saving file to DB:', { filename, gridfsId, size, uploadedBy });
  try {
    if (!gridfsId || !(gridfsId instanceof mongoose.Types.ObjectId)) {
      throw new Error('Invalid or missing gridfsId');
    }
    const gridfsFile = await mongoose.connection.db.collection('uploads.files').findOne({ _id: gridfsId });
    if (!gridfsFile) {
      throw new Error(`GridFS file not found for ID: ${gridfsId}`);
    }
    const newFile = new File({
      filename,
      gridfsId,
      size,
      contentType,
      uploadedBy: new mongoose.Types.ObjectId(uploadedBy),
      uploadDate: new Date()
    });
    const saved = await newFile.save();
    console.log('File saved:', saved);
    return saved;
  } catch (err) {
    console.error('Error saving file:', err);
    throw err;
  }
};

exports.getUserFiles = async (req, res) => {
  console.log('Fetching user files');
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const files = await File.find({ uploadedBy: userId }).select('filename size uploadDate gridfsId');
    const validFiles = files
      .filter(file => file.gridfsId && /^[0-9a-fA-F]{24}$/.test(file.gridfsId.toString()))
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
};

exports.getFileById = async (fileId, userId) => {
  console.log(`Fetching file by ID: ${fileId}`);
  try {
    const file = await File.findById(fileId);
    if (!file || file.uploadedBy.toString() !== userId.toString()) {
      return null;
    }
    if (!file.gridfsId || !/^[0-9a-fA-F]{24}$/.test(file.gridfsId.toString())) {
      console.warn(`File ${file.filename} (ID: ${fileId}) missing or invalid gridfsId`);
      await File.deleteOne({ _id: file._id });
      throw new Error('File missing or invalid gridfsId');
    }
    return file;
  } catch (err) {
    console.error('Error fetching file:', err);
    throw err;
  }
};

exports.deleteFileDocument = async (fileId) => {
  console.log(`Deleting file document: ${fileId}`);
  try {
    return await File.findByIdAndDelete(fileId);
  } catch (err) {
    console.error('Error deleting file:', err);
    throw err;
  }
};