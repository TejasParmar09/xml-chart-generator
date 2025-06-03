import React from 'react';
import toast, { Toaster } from 'react-hot-toast'; // Added Toaster to ensure toast notifications are rendered
import api from '../api/apiClient';
import { useNavigate } from 'react-router-dom';

export default function UploadedFileSection({ files, isLoading, error, onFileSelect, onFileSelected }) {
  const navigate = useNavigate();

  const handleDelete = async (e, gridfsId) => {
    e.stopPropagation();
    console.log('Delete button clicked for gridfsId:', gridfsId);
    console.log('handleDelete function called');
    if (!window.confirm('Are you sure you want to delete this file?')) return;

    try {
      await api.userFiles.delete(gridfsId); // Use gridfsId instead of fileId
      toast.success('File deleted successfully.');
      if (onFileSelected) {
        onFileSelected(); // Trigger refresh in parent component
      }
    } catch (err) {
      console.error('Error deleting file:', err);
      let errorMessage = 'Failed to delete file.';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      toast.error(errorMessage);
    }
  };

  const handleView = (fileId, gridfsId) => {
    console.log('handleView function called for file ID:', fileId, 'with gridfsId:', gridfsId);
    navigate(`/user/files/${fileId}`, { state: { gridfsId: gridfsId } }); // Pass gridfsId to the file details page
  };

  const handleSelectForChart = (file) => {
    console.log('Chart button clicked for file:', file);
    console.log('handleSelectForChart called.');
    if (onFileSelectForChart) {
      onFileSelectForChart(file); // Pass the entire file object to the parent for chart generation
    } else {
      console.warn('onFileSelectForChart prop is not provided.');
      toast.error('Chart functionality is not available.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 mx-auto max-w-md text-center text-red-600">
        <h3 className="text-2xl font-bold mb-4">Error Loading Files</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!files || files.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 mx-auto max-w-md text-center text-gray-600">
        <h3 className="text-2xl font-bold mb-4">No Files Found</h3>
        <p>You haven't uploaded any files yet.</p>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" /> {/* Ensure toast notifications are rendered */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-2xl font-bold text-gray-800 mb-6">Your Uploaded Files</h3>
        <ul className="divide-y divide-gray-200">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between py-4 transition-all duration-200 hover:bg-gray-50 rounded-md px-4">
              <div className="flex-1 min-w-0 pr-4">
                <h4 className="font-semibold text-lg text-gray-900 truncate">{file.name}</h4>
                <p className="text-sm text-gray-600">
                  Uploaded: <span className="font-mono">{file.uploadDate ? new Date(file.uploadDate).toLocaleString() : 'N/A'}</span> • Size: <span className="font-mono">{file.size ? `${(file.size / 1024).toFixed(2)} KB` : 'N/A'}</span>
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={(e) => handleDelete(e, file.gridfsId)} // Use gridfsId instead of file.id
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all duration-200 shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}