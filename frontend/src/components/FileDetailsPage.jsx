import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/apiClient';
import toast, { Toaster } from 'react-hot-toast';
import { jsPDF } from 'jspdf';

const FileDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [fileDetails, setFileDetails] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [username, setUsername] = useState('N/A');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFileDetails = async () => {
      if (!id) {
        console.error('File ID is missing from URL parameters.');
        setError('File ID is missing.');
        setIsLoading(false);
        return;
      }

      try {
        console.log(`Fetching file details for ID: ${id}`);
        const detailsResponse = await api.admin.files.getById(id);
        console.log('File details response:', detailsResponse.data);
        if (!detailsResponse.data) {
          throw new Error('No data returned from getById API.');
        }
        setFileDetails({
          id: detailsResponse.data._id || detailsResponse.data.id,
          name: detailsResponse.data.filename || 'Untitled File',
          uploadDate: detailsResponse.data.uploadDate || detailsResponse.data.createdAt,
          size: detailsResponse.data.size,
          type: detailsResponse.data.type || 'xml',
          uploadedBy: detailsResponse.data.uploadedBy,
        });

        // Fetch username (assuming backend returns uploadedBy user ID)
        if (detailsResponse.data.uploadedBy) {
          try {
            const userResponse = await api.users.getUser(detailsResponse.data.uploadedBy);
            setUsername(userResponse.data.name || userResponse.data.username || 'Unknown User');
          } catch (userErr) {
            console.warn('Error fetching username:', userErr);
            setUsername('Unknown User');
          }
        }

        console.log(`Fetching file content for ID: ${id}`);
        const contentResponse = await api.admin.files.getContent(id);
        console.log('File content response:', contentResponse.data);
        setFileContent(contentResponse.data.data || null);
      } catch (err) {
        console.error('Error fetching file details or content:', err);
        let errorMessage = 'Failed to load file details.';
        if (err.response?.data?.message) {
          errorMessage = err.response.data.message;
        } else if (err.message) {
          errorMessage = err.message;
        }
        setError(errorMessage);
        toast.error(errorMessage);
        if (err.response?.status === 401) {
          navigate('/login', { replace: true });
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchFileDetails();
  }, [id, navigate]);

  const handleDownload = async () => {
    if (!fileDetails) {
      toast.error('No file details available to download.');
      return;
    }

    try {
      console.log('Generating PDF with fileDetails:', fileDetails);
      console.log('Generating PDF with fileContent:', fileContent);

      const doc = new jsPDF();
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(20);
      doc.setTextColor(33, 41, 73);

      const title = `File Details: ${fileDetails.name || 'Unknown File'}`;
      doc.text(title, 20, 20);

      doc.setFontSize(12);
      doc.setTextColor(55, 65, 81);
      let yPosition = 40;
      doc.text(`File Name: ${fileDetails.name || 'N/A'}`, 20, yPosition);
      yPosition += 10;
      doc.text(`Uploaded By: ${username}`, 20, yPosition);
      yPosition += 10;
      doc.text(`Size: ${fileDetails.size ? `${(fileDetails.size / 1024).toFixed(2)} KB` : 'N/A'}`, 20, yPosition);
      yPosition += 10;
      doc.text(
        `Uploaded On: ${
          fileDetails.uploadDate
            ? `${new Date(fileDetails.uploadDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })} at ${new Date(fileDetails.uploadDate).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : 'N/A'
        }`,
        20,
        yPosition
      );

      yPosition += 20;
      doc.setFontSize(14);
      doc.setTextColor(33, 41, 73);
      doc.text('File Content (XML):', 20, yPosition);

      yPosition += 10;
      doc.setFont('Courier');
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);

      let contentString = fileContent ? JSON.stringify(fileContent, null, 2) : 'No content available.';
      if (!contentString || contentString === '{}') {
        contentString = 'No valid content found in the file.';
      }

      const contentLines = doc.splitTextToSize(contentString, 170);
      let pageHeight = doc.internal.pageSize.height;
      let lineIndex = 0;

      while (lineIndex < contentLines.length) {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(contentLines[lineIndex], 20, yPosition);
        yPosition += 7;
        lineIndex++;
      }

      const fileName = fileDetails.name ? fileDetails.name.replace(/\.xml$/, '') : 'file';
      doc.save(`${fileName}.pdf`);
      toast.success('PDF downloaded successfully!');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Failed to generate PDF. Check console for details.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8 min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
      </div>
    );
  }

  if (error || !fileDetails) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 mx-auto max-w-md text-center min-h-screen bg-gray-50">
        <Toaster position="top-right" />
        <h3 className="text-2xl font-bold text-red-600 mb-4">Error Loading File</h3>
        <p className="text-gray-700 mb-6">{error || 'File not found'}</p>
        <button
          onClick={() => navigate('/admin/files')}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-150 ease-in-out shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Back to Files
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/admin/files')}
            className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-all duration-200 shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Files
          </button>
          <h2 className="ml-6 text-2xl font-bold text-gray-800">File Details</h2>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Filename</p>
              <p className="mt-1 text-gray-900 text-lg font-semibold">{fileDetails.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Uploaded By</p>
              <p className="mt-1 text-gray-900">{username}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Upload Date</p>
              <p className="mt-1 text-gray-900">
                {fileDetails.uploadDate ? new Date(fileDetails.uploadDate).toLocaleString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">File Size</p>
              <p className="mt-1 text-gray-900">
                {fileDetails.size ? `${(fileDetails.size / 1024).toFixed(2)} KB` : 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex justify-end mb-8">
            <button
              onClick={handleDownload}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-150 ease-in-out shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Download PDF
            </button>
          </div>

          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-3 border-b-2 border-blue-200 pb-2">File Content</h3>
            <div className="mt-1 bg-gray-100 p-4 rounded-xl overflow-auto max-h-96 whitespace-pre-wrap break-words text-sm leading-relaxed shadow-inner">
              {fileContent ? (
                <pre className="text-gray-800 font-mono">{JSON.stringify(fileContent, null, 2)}</pre>
              ) : (
                <p className="text-gray-600">No content available or failed to parse content.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileDetailsPage;