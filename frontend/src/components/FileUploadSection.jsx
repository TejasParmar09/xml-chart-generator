import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import toast, { Toaster } from 'react-hot-toast';
import ChartGenerator from './ChartGenerator';
import api from '../api/apiClient';
import * as XLSX from 'xlsx';

const FileUploadSection = ({ onFileUpload, isLoading }) => {
  const [files, setFiles] = useState([]);
  const [selectedFileData, setSelectedFileData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedChart, setSelectedChart] = useState('bar');
  const [selectedXAxis, setSelectedXAxis] = useState(null);
  const [selectedYAxes, setSelectedYAxes] = useState([]);
  const [fieldOptions, setFieldOptions] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);
  const [isFetchingFiles, setIsFetchingFiles] = useState(false);
  const [is3DMode, setIs3DMode] = useState(false);

  const chartTypeContainerRef = useRef(null);

  useEffect(() => {
    console.log('Files state updated:', files);
  }, [files]);

  const handleUnauthorized = () => {
    toast.error('Please log in to continue.');
  };

  useEffect(() => {
    const fetchFiles = async () => {
      setIsFetchingFiles(true);
      try {
        console.log('Fetching files from API');
        const response = await api.userFiles.getAll();
        const fetchedFiles = response.data.files || [];
        console.log('Fetched files:', fetchedFiles);
        const processedFiles = fetchedFiles
          .filter(file => {
            if (!file.gridfsId || !/^[0-9a-fA-F]{24}$/.test(file.gridfsId)) {
              console.warn(`Skipping file ${file.filename} (ID: ${file._id}) due to missing or invalid gridfsId: ${file.gridfsId}`);
              return false;
            }
            return true;
          })
          .map(file => ({
            id: file._id || file.gridfsId || Math.random().toString(36).substring(7),
            name: file.filename || file.name || 'Unnamed File',
            size: file.size,
            uploadDate: file.uploadDate,
            gridfsId: file.gridfsId,
          }));
        console.log('Checking file IDs after processing:', processedFiles.map(file => ({ _id_from_backend: file._id, frontend_id: file.id })));
        console.log('Processed files with valid gridfsId:', processedFiles);
        setFiles(processedFiles);
        setSelectedFile(null);
        setSelectedFileData(null);
        setFieldOptions([]);
        setSelectedXAxis(null);
        setSelectedYAxes([]);
        setSelectedChart('bar');
        setShowChart(false);
        setIs3DMode(false);
      } catch (error) {
        console.error('Error fetching files:', error);
        if (error.response?.status === 401) {
          handleUnauthorized();
        } else if (error.response?.status === 404 && error.response?.data?.error === 'No files found') {
          setFiles([]);
        } else {
          toast.error(error.response?.data?.message || 'Failed to load uploaded files');
        }
      } finally {
        setIsFetchingFiles(false);
      }
    };

    fetchFiles();
  }, []);

  useEffect(() => {
    setSelectedFile(null);
  }, []);

  const handleFileUpload = async (file) => {
    if (!file) {
      toast.error('No file selected.');
      return;
    }

    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!['.xml', '.xlsx', '.xls'].includes(fileExtension)) {
      toast.error('Please upload a valid XML or Excel file (.xml, .xlsx, .xls).');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      setIsDragging(false);
      console.log('Uploading file:', file.name);
      const uploadResponse = await api.userFiles.upload(formData);
      console.log('Upload response:', uploadResponse.data);

      if (!uploadResponse.data.file.gridfsId || !/^[0-9a-fA-F]{24}$/.test(uploadResponse.data.file.gridfsId)) {
        console.error('Invalid gridfsId in upload response:', uploadResponse.data.file.gridfsId);
        throw new Error('Invalid GridFS ID returned from server');
      }

      const newFile = {
        id: uploadResponse.data.file._id,
        name: file.name || 'Unnamed File',
        size: file.size,
        uploadDate: new Date().toISOString(),
        gridfsId: uploadResponse.data.file.gridfsId,
      };

      setFiles((prevFiles) => [...prevFiles, newFile]);
      setSelectedFile(null);
      setSelectedFileData(null);
      setSelectedChart('bar');
      setSelectedXAxis(null);
      setSelectedYAxes([]);
      setFieldOptions([]);
      setShowChart(false);
      setIs3DMode(false);

      if (onFileUpload) {
        onFileUpload();
      }

      toast.success(`File "${newFile.name}" uploaded successfully!`);
    } catch (error) {
      console.error('Error uploading file:', error);
      let errorMessage = 'Failed to upload file. Please try again.';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      
      setSelectedFile(null);
      setSelectedFileData(null);
      setFieldOptions([]);
      setShowChart(false);
      setIs3DMode(false);
    }
  };

  const getFallbackData = () => [
    { name: 'A', value: 100 },
    { name: 'B', value: 150 },
    { name: 'C', value: 120 },
  ];

  const cleanFieldName = (field) => {
    const parts = field.split(/[\.\s]/);
    return parts[parts.length - 1].toLowerCase();
  };

  const formatFieldName = (field) =>
    field
      .split(/[-_\s]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .trim();

  const flattenObject = (obj, prefix = '') => {
    const result = {};
    for (const key in obj) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      const cleanKey = cleanFieldName(newKey);

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        if (value.every((item) => typeof item !== 'object')) {
          result[cleanKey] = value;
        } else {
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              Object.assign(result, flattenObject(item, `${newKey}.${index}`));
            } else {
              result[`${cleanKey}.${index}`] = item;
            }
          });
        }
      } else {
        result[cleanKey] = value;
      }
    }
    return result;
  };

  const findItemsArray = (obj) => {
    if (Array.isArray(obj)) {
      return obj;
    }

    const searchForArray = (o, path = '') => {
      if (Array.isArray(o)) {
        return o;
      }
      if (o && typeof o === 'object') {
        for (const key in o) {
          const newPath = path ? `${path}.${key}` : key;
          const value = o[key];
          if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
            return value;
          }
        }
        for (const key in o) {
          const newPath = path ? `${path}.${key}` : key;
          const result = searchForArray(o[key], newPath);
          if (result) return result;
        }
      }
      return null;
    };

    const items = searchForArray(obj);
    if (items && items.length > 0) return items;
    return [obj];
  };

  const analyzeFields = (data) => {
    if (!data || typeof data !== 'object') {
      return { allFields: [] };
    }

    const items = findItemsArray(data);
    if (!items || items.length === 0) {
      return { allFields: [] };
    }

    const flattenedItems = items.map((item) => flattenObject(item));
    const fieldValues = new Map();

    flattenedItems.forEach((item) => {
      if (item && typeof item === 'object') {
        Object.entries(item).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          const cleanKey = cleanFieldName(key);
          if (!fieldValues.has(cleanKey)) {
            fieldValues.set(cleanKey, { values: new Set() });
          }

          const fieldData = fieldValues.get(cleanKey);
          const processValue = (val) => {
            if (val === null || val === undefined) return;
            fieldData.values.add(val);
          };

          if (Array.isArray(value)) {
            value.forEach(processValue);
          } else {
            processValue(value);
          }
        });
      }
    });

    const fieldsToExclude = new Set(['id', 'uploaddate', 'size', 'createdat', 'updatedat']);
    const allFields = Array.from(fieldValues.entries())
      .filter(([key]) => !fieldsToExclude.has(key))
      .map(([key, data]) => ({
        value: key,
        label: formatFieldName(key),
        values: Array.from(data.values),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return { allFields };
  };

  const parseExcelData = (excelData) => {
    try {
      // Validate input
      if (!excelData || typeof excelData !== 'string') {
        throw new Error('Invalid Excel data: Expected a base64 string');
      }

      // Read the Excel file directly from base64
      const workbook = XLSX.read(excelData, { type: 'base64' });
      
      // Log workbook info for debugging
      console.log('Workbook sheets:', workbook.SheetNames);
      
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('No sheets found in Excel file');
      }
      
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Log worksheet info for debugging
      console.log('Worksheet range:', worksheet['!ref']);
      
      // Parse with raw values to preserve numbers
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false,
        raw: true
      });

      console.log('Parsed raw JSON data from Excel:', jsonData);

      if (jsonData.length === 0) {
        throw new Error('No data found in Excel file');
      }

      // Get headers from first row
      const headers = jsonData[0];
      if (!headers || headers.length === 0) {
        throw new Error('No headers found in Excel file');
      }

      // Convert data to objects using headers and handle numeric conversion
      const items = jsonData.slice(1).map((row, rowIndex) => {
        const item = {};
        headers.forEach((header, colIndex) => {
          if (header) { // Only add non-null headers
            const lowerCaseHeader = header.toLowerCase(); // Convert header to lowercase
            let value = row[colIndex];

            // If the value is null, undefined, or an empty string, treat it as 0.
            if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
              item[lowerCaseHeader] = 0;
            } else if (typeof value === 'string' && !isNaN(value)) {
              // If it's a string that can be converted to a number, convert it.
              item[lowerCaseHeader] = Number(value);
            } else if (typeof value === 'number') {
              // If it's already a number (from raw: true), keep it as is.
              item[lowerCaseHeader] = value;
            } else {
              // For other types (e.g., non-numeric strings like 'State'), keep as is.
              item[lowerCaseHeader] = value;
            }
          }
        });
        console.log(`Processed item ${rowIndex}:`, item);
        return item;
      });

      // Filter out entirely empty rows (where all values are 0 or blank after initial processing)
      const validItems = items.filter(item => {
        const hasValues = Object.values(item).some(value => value !== 0 && value !== null && value !== undefined && value !== '');
        return hasValues;
      });

      if (validItems.length === 0) {
        throw new Error('No valid data rows found in Excel file');
      }
      
      // Convert headers to field options compatible with react-select
      const fieldOptions = headers
        .filter(Boolean)
        .map(header => ({
          value: header,
          label: formatFieldName(header)
        }));

      // Log the final processed data
      console.log('Processed items:', validItems);
      console.log('Field options:', fieldOptions);

      return {
        items: validItems,
        allFields: fieldOptions
      };
    } catch (error) {
      console.error('Error parsing Excel data:', error);
      throw new Error('Failed to parse Excel file: ' + error.message);
    }
  };

  const handleFileSelect = async (file) => {
    try {
      console.log('Attempting to select file:', file.name, 'with gridfsId:', file.gridfsId);
      if (!file.gridfsId) {
        console.error('File selected is missing GridFS ID:', file);
        toast.error('Error loading file: This file is missing necessary information. Please re-upload it.');
        setSelectedFile(null);
        setSelectedFileData(null);
        setFieldOptions([]);
        setShowChart(false);
        setIs3DMode(false);
        return;
      }

      console.log('Selecting file:', file.name);
      setSelectedFile(file);
      setSelectedFileData(null);
      setSelectedXAxis(null);
      setSelectedYAxes([]);
      setShowChart(false);

      const processResponse = await api.userFiles.getContent(file.gridfsId);
      console.log('File content response:', processResponse.data);

      if (!processResponse.data || !processResponse.data.data) {
        throw new Error('Invalid data received from server: Missing "data" property');
      }

      let items = [];
      let allFields = [];

      if (processResponse.data.fileType === 'excel') {
        try {
          // Parse Excel data
          const { items: excelItems, allFields: excelFields } = parseExcelData(processResponse.data.data);
          console.log('Parsed Excel items:', excelItems);
          console.log('Parsed Excel fields:', excelFields);
          items = excelItems;
          allFields = excelFields;
          setFieldOptions(allFields);
        } catch (excelError) {
          console.error('Excel parsing error:', excelError);
          toast.error(excelError.message || 'Failed to parse Excel file');
          setSelectedFileData(null);
          setFieldOptions([]);
          setSelectedXAxis(null);
          setSelectedYAxes([]);
          setShowChart(false);
          throw excelError;
        }
      } else {
        // For XML files, process as before
        const { allFields: xmlFields } = analyzeFields(processResponse.data.data);
        console.log('Parsed XML fields:', xmlFields);
        allFields = xmlFields;
        setFieldOptions(allFields);
        items = findItemsArray(processResponse.data.data);
        console.log('Parsed XML items:', items);
      }

      if (!items || items.length === 0 || items.every((item) => !item || Object.keys(item).length === 0)) {
        console.warn(`No valid data found in file "${file.name}". Attempting fallback data.`);
        items = getFallbackData();
        if (!items || items.length === 0) {
          toast.error(`No data found in file "${file.name}" and no fallback data available.`);
          setSelectedFileData(null);
          setFieldOptions([]);
          setSelectedXAxis(null);
          setSelectedYAxes([]);
          setSelectedChart('bar');
          setShowChart(false);
          setIs3DMode(false);
          return;
        }
        const { allFields: fallbackFields } = analyzeFields({ items });
        setFieldOptions(fallbackFields);
        setSelectedFileData(items);
        setSelectedXAxis(null);
        setSelectedYAxes([]);
        setSelectedChart('bar');
        setShowChart(false);
        setIs3DMode(false);
        toast.warn(`No data found in file "${file.name}". Using fallback data.`);
        return;
      }

      setSelectedFileData(items);
      setSelectedXAxis(null);
      setSelectedYAxes([]);
      setSelectedChart('bar');
      setShowChart(false);
      setIs3DMode(false);

      toast.success(`File "${file.name}" loaded successfully!`);
    } catch (error) {
      console.error('Error selecting file:', error);
      if (error.response?.status === 401) {
        handleUnauthorized();
      } else {
        toast.error(error.message || error.response?.data?.message || 'Failed to load file data');
      }
      setSelectedFile(null);
      setSelectedFileData(null);
      setFieldOptions([]);
      setSelectedXAxis(null);
      setSelectedYAxes([]);
      setSelectedChart('bar');
      setShowChart(false);
      setIs3DMode(false);
    }
  };

  const handleDeleteFile = async (file) => {
    if (!file.gridfsId || !/^[0-9a-fA-F]{24}$/.test(file.gridfsId)) {
      console.error('Invalid gridfsId for deletion:', file.name, file.gridfsId);
      toast.error(`Cannot delete file "${file.name}": invalid GridFS ID`);
      return;
    }

    try {
      console.log(`Deleting file with gridfsId: ${file.gridfsId}`);
      await api.userFiles.delete(file.gridfsId);
      setFiles((prevFiles) => prevFiles.filter(f => f.gridfsId !== file.gridfsId));
      if (selectedFile && selectedFile.gridfsId === file.gridfsId) {
        setSelectedFile(null);
        setSelectedFileData(null);
        setSelectedChart(null);
        setSelectedXAxis(null);
        setSelectedYAxes([]);
        setFieldOptions([]);
        setShowChart(false);
        setIs3DMode(false);
      }
      toast.success(`File "${file.name}" deleted successfully.`);
    } catch (error) {
      console.error('Error deleting file:', error);
      if (error.response?.status === 401) {
        handleUnauthorized();
      } else {
        toast.error(error.response?.data?.message || 'Failed to delete file');
      }
    }
  };

  const handleClearFiles = async () => {
    try {
      console.log('Clearing all files');
      await Promise.all(
        files.map(async (file) => {
          if (!file.gridfsId || !/^[0-9a-fA-F]{24}$/.test(file.gridfsId)) {
            console.warn(`Skipping deletion of file ${file.name} with invalid gridfsId: ${file.gridfsId}`);
            return;
          }
          console.log(`Deleting file with gridfsId: ${file.gridfsId}`);
          await api.userFiles.delete(file.gridfsId);
        })
      );

      setFiles([]);
      setSelectedFile(null);
      setSelectedFileData(null);
      setSelectedChart(null);
      setSelectedXAxis(null);
      setSelectedYAxes([]);
      setFieldOptions([]);
      setShowChart(false);
      setIs3DMode(false);
      toast.success('All files cleared successfully.');
    } catch (error) {
      console.error('Error clearing files:', error);
      if (error.response?.status === 401) {
        handleUnauthorized();
      } else {
        toast.error(error.response?.data?.message || 'Failed to clear files');
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  };

  const handleXAxisSelect = (selectedOption) => {
    setSelectedXAxis(selectedOption);
  };

  const handleYAxesSelect = (selectedOptions) => {
    setSelectedYAxes(selectedOptions || []);
  };

  const handleChartTypeSelect = (type) => {
    setSelectedChart(type);
  };

  const handleGenerateChart = () => {
    if (!selectedChart) {
      toast.error('Please select a chart type');
      return;
    }
    if (!selectedXAxis) {
      toast.error('Please select an X-axis');
      return;
    }
    if (selectedYAxes.length === 0) {
      toast.error('Please select at least one Y-axis');
      return;
    }
    if (selectedChart === 'pie' && selectedYAxes.length > 1) {
      toast.error('Pie chart supports only one Y-axis. Please select exactly one Y-axis.');
      return;
    }
    if (selectedChart === 'waterfall' && selectedYAxes.length > 1) {
      toast.error('Waterfall chart supports only one Y-axis. Please select exactly one Y-axis.');
      return;
    }
    if (selectedChart === 'radar' && !selectedXAxis) {
      toast.error('Radar chart requires an X-axis for categories.');
      return;
    }

    setIsGeneratingChart(true);
    setShowChart(true);
    setIs3DMode(false);
    setIsGeneratingChart(false);
  };

  const handleGenerate3DChart = () => {
    if (!selectedChart) {
      toast.error('Please select a chart type');
      return;
    }
    if (!selectedXAxis) {
      toast.error('Please select an X-axis');
      return;
    }
    if (selectedYAxes.length === 0) {
      toast.error('Please select at least one Y-axis');
      return;
    }
    if (selectedChart === 'pie' || selectedChart === 'waterfall' || selectedChart === 'radar' || selectedChart === 'area') {
      toast.error(`3D mode is not supported for ${selectedChart} charts.`);
      return;
    }

    setIsGeneratingChart(true);
    setShowChart(true);
    setIs3DMode(true);
    setIsGeneratingChart(false);
  };

  const scrollLeft = () => {
    if (chartTypeContainerRef.current) {
      chartTypeContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (chartTypeContainerRef.current) {
      chartTypeContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
            padding: '16px',
            fontSize: '16px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
          },
          success: {
            style: {
              background: '#10B981',
            },
          },
          error: {
            style: {
              background: '#EF4444',
            },
          },
        }}
      />
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 bg-gradient-to-r from-indigo-600 to-blue-500 rounded-2xl p-6 shadow-lg">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">XML Chart Generator</h1>
          <p className="text-indigo-100">Upload your XML file and create beautiful visualizations</p>
        </div>
        <div className="mb-8">
          <div
            className={`relative border-3 border-dashed rounded-2xl p-8 transition-all duration-300 transform hover:scale-[1.01] ${
              isDragging ? 'border-indigo-500 bg-indigo-50 shadow-indigo-200' : 'border-gray-300 hover:border-indigo-400 bg-white'
            } shadow-lg`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <div className="mx-auto w-24 h-24 mb-4 text-indigo-500 transition-transform duration-300 transform group-hover:scale-110">
                <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 14v20c0 4.418 3.582 8 8 8h16c4.418 0 8-3.582 8-8V14m-20 6l8-8 8 8m-8-8v28"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">
                Drop your XML or Excel file here, or{' '}
                <label className="inline-block">
                  <span className="text-indigo-600 hover:text-indigo-500 cursor-pointer transition-colors duration-200 border-b-2 border-indigo-600 hover:border-indigo-500">
                    browse
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".xml,.xlsx,.xls"
                    onChange={(e) => handleFileUpload(e.target.files[0])}
                    disabled={isLoading || isFetchingFiles}
                  />
                </label>
              </h3>
              <p className="mt-2 text-sm text-gray-500">XML or Excel files only, up to 10MB</p>
            </div>
          </div>
        </div>
        {isFetchingFiles ? (
          <div className="text-center text-gray-500">
            <p>Loading files...</p>
          </div>
        ) : files.length > 0 ? (
          <div className="mb-8 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-xl">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Uploaded Files</h2>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`p-4 transition-all duration-200 hover:shadow-md ${
                    selectedFile?.id === file.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(file.uploadDate).toLocaleString()} • {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleFileSelect(file)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                          selectedFile?.id === file.id
                            ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700'
                            : 'text-indigo-600 hover:bg-indigo-50 border border-indigo-600'
                        } ${!file.gridfsId ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={isLoading || isFetchingFiles

 || !file.gridfsId}
                      >
                        {selectedFile?.id === file.id ? 'Selected' : 'Select'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-8 text-center text-gray-500">
            <p>No files uploaded yet. Upload an XML or Excel file to get started!</p>
          </div>
        )}
        {selectedFile && selectedFileData && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-xl">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-2xl font-bold text-gray-900">Chart Configuration</h2>
              <p className="mt-1 text-sm text-gray-500">Configure visualization for {selectedFile.name}</p>
            </div>
            <div className="p-10 space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-8 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Select Chart Type
                </h3>
                <div className="relative">
                  <button
                    onClick={scrollLeft}
                    className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 z-10"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div
                    ref={chartTypeContainerRef}
                    className="flex overflow-x-auto scrollbar-hide space-x-4 pb-8 pt-8 px-12"
                    style={{ scrollBehavior: 'smooth' }}
                  >
                    {['bar', 'line', 'pie', 'scatter', 'waterfall', 'area', 'stackedbar', 'radar'].map((type) => (
                      <button
                        key={type}
                        onClick={() => handleChartTypeSelect(type)}
                        className={`relative flex-shrink-0 p-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 group ${
                          selectedChart === type
                            ? 'border-indigo-600 bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-600 shadow-lg'
                            : 'border-gray-200 hover:border-indigo-300 hover:shadow-lg bg-white'
                        } w-40`}
                        disabled={isLoading || isFetchingFiles}
                      >
                        <div className="text-center space-y-3">
                          <div className="w-12 h-12 mx-auto">
                            {type === 'bar' && (
                              <svg
                                className={`w-full h-full transition-colors duration-200 ${
                                  selectedChart === type ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                />
                              </svg>
                            )}
                            {type === 'line' && (
                              <svg
                                className={`w-full h-full transition-colors duration-200 ${
                                  selectedChart === type ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                                />
                              </svg>
                            )}
                            {type === 'pie' && (
                              <svg
                                className={`w-full h-full transition-colors duration-200 ${
                                  selectedChart === type ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
                                />
                                
                              </svg>
                            )}
                            {type === 'scatter' && (
                              <svg
                                className={`w-full h-full transition-colors duration-200 ${
                                  selectedChart === type ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 3h18M3 21h18M6 6h.01M9 9h.01M12 12h.01M15 15h.01M18 18h.01M6 18h.01M18 6h.01"
                                />
                              </svg>
                            )}
                            {type === 'waterfall' && (
                              <svg
                                className={`w-full h-full transition-colors duration-200 ${
                                  selectedChart === type ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 12h4v8H3zm6-4h4v12H9zm6-8h4v20h-4z"
                                />
                              </svg>
                            )}
                            {type === 'area' && (
                              <svg
                                className={`w-full h-full transition-colors duration-200 ${
                                  selectedChart === type ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 12l3-3 3 3 4-4M3 21h18V5H3v16z"
                                />
                              </svg>
                            )}
                            {type === 'stackedbar' && (
                              <svg
                                className={`w-full h-full transition-colors duration-200 ${
                                  selectedChart === type ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 19v-4H5v4h4zm0-6v-4H5v4h4zm0-6V3H5v4h4zm6 12v-8h-4v8h4zm0-10v-4h-4v4h4zm0-6V3h-4v4h4z"
                                />
                              </svg>
                            )}
                            {type === 'radar' && (
                              <svg
                                className={`w-full h-full transition-colors duration-200 ${
                                  selectedChart === type ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-8l2 2 2-2-2-2-2 2z"
                                />
                              </svg>
                            )}
                          </div>
                          <p
                            className={`text-sm font-medium transition-colors duration-200 ${
                              selectedChart === type ? 'text-indigo-600' : 'text-gray-600 group-hover:text-indigo-500'
                            }`}
                          >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={scrollRight}
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 z-10"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">X-Axis</label>
                    <Select
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                    classNamePrefix="react-select"
                    options={fieldOptions}
                      value={selectedXAxis}
                      onChange={handleXAxisSelect}
                      placeholder="Select X-Axis"
                    className="text-sm"
                    isDisabled={isLoading || isFetchingFiles}
                    getOptionValue={(option) => option.value}
                      styles={{
                        menu: (provided) => ({
                          ...provided,
                          zIndex: 999,
                          position: 'absolute',
                          width: '100%',
                          backgroundColor: '#fff',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          marginTop: '4px',
                        }),
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        container: (base) => ({ ...base, zIndex: 50 }),
                        control: (base, state) => ({
                          ...base,
                          minHeight: '42px',
                          background: '#fff',
                          borderColor: state.isFocused ? '#4F46E5' : '#E5E7EB',
                          boxShadow: state.isFocused ? '0 0 0 2px rgba(79, 70, 229, 0.2)' : 'none',
                          '&:hover': { borderColor: '#4F46E5' },
                        }),
                        menuList: (base) => ({
                          ...base,
                          maxHeight: '300px',
                          padding: '4px',
                          '::-webkit-scrollbar': { width: '8px', height: '8px' },
                          '::-webkit-scrollbar-track': { background: '#F3F4F6', borderRadius: '4px' },
                          '::-webkit-scrollbar-thumb': { background: '#94A3B8', borderRadius: '4px', '&:hover': { background: '#64748B' } },
                        }),
                        option: (base, state) => ({
                          ...base,
                          padding: '8px 12px',
                          cursor: 'pointer',
                          backgroundColor: state.isSelected ? '#4F46E5' : state.isFocused ? '#EEF2FF' : 'transparent',
                          color: state.isSelected ? 'white' : '#1F2937',
                          fontSize: '14px',
                          fontWeight: state.isSelected ? '500' : '400',
                          '&:active': { backgroundColor: state.isSelected ? '#4F46E5' : '#E0E7FF' },
                        }),
                        input: (base) => ({ ...base, color: '#1F2937' }),
                        singleValue: (base) => ({ ...base, color: '#1F2937' }),
                        multiValue: (base) => ({ ...base, backgroundColor: '#EEF2FF', borderRadius: '4px' }),
                        multiValueLabel: (base) => ({ ...base, color: '#4F46E5', padding: '2px 6px', fontSize: '14px' }),
                        multiValueRemove: (base) => ({
                          ...base,
                          color: '#4F46E5',
                          ':hover': { backgroundColor: '#E0E7FF', color: '#4338CA' },
                        }),
                        placeholder: (base) => ({ ...base, color: '#6B7280' }),
                        valueContainer: (base) => ({ ...base, padding: '2px 8px' }),
                        dropdownIndicator: (base, state) => ({
                          ...base,
                          color: state.isFocused ? '#4F46E5' : '#6B7280',
                          ':hover': { color: '#4F46E5' },
                          padding: '8px',
                        }),
                        clearIndicator: (base) => ({
                          ...base,
                          color: '#6B7280',
                          ':hover': { color: '#4F46E5' },
                          padding: '8px',
                        }),
                        indicatorSeparator: (base) => ({ ...base, backgroundColor: '#E5E7EB' }),
                      }}
                    />
                  </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Y-Axis (Values)</label>
                    <Select
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                    classNamePrefix="react-select"
                    isMulti
                    options={fieldOptions}
                      value={selectedYAxes}
                      onChange={handleYAxesSelect}
                    placeholder="Select Y-Axis Values"
                    className="text-sm"
                    isDisabled={isLoading || isFetchingFiles}
                    getOptionValue={(option) => option.value}
                      styles={{
                        menu: (provided) => ({
                          ...provided,
                          zIndex: 999,
                          position: 'absolute',
                          width: '100%',
                          backgroundColor: '#fff',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          marginTop: '4px',
                        }),
                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                        container: (base) => ({ ...base, zIndex: 40 }),
                        control: (base, state) => ({
                          ...base,
                          minHeight: '42px',
                          background: '#fff',
                          borderColor: state.isFocused ? '#4F46E5' : '#E5E7EB',
                          boxShadow: state.isFocused ? '0 0 0 2px rgba(79, 70, 229, 0.2)' : 'none',
                          '&:hover': { borderColor: '#4F46E5' },
                        }),
                        menuList: (base) => ({
                          ...base,
                          maxHeight: '300px',
                          padding: '4px',
                          '::-webkit-scrollbar': { width: '8px', height: '8px' },
                          '::-webkit-scrollbar-track': { background: '#F3F4F6', borderRadius: '4px' },
                          '::-webkit-scrollbar-thumb': { background: '#94A3B8', borderRadius: '4px', '&:hover': { background: '#64748B' } },
                        }),
                        option: (base, state) => ({
                          ...base,
                          padding: '8px 12px',
                          cursor: 'pointer',
                          backgroundColor: state.isSelected ? '#4F46E5' : state.isFocused ? '#EEF2FF' : 'transparent',
                          color: state.isSelected ? 'white' : '#1F2937',
                          fontSize: '14px',
                          fontWeight: state.isSelected ? '500' : '400',
                          '&:active': { backgroundColor: state.isSelected ? '#4F46E5' : '#E0E7FF' },
                        }),
                        input: (base) => ({ ...base, color: '#1F2937' }),
                        singleValue: (base) => ({ ...base, color: '#1F2937' }),
                        multiValue: (base) => ({ ...base, backgroundColor: '#EEF2FF', borderRadius: '4px' }),
                        multiValueLabel: (base) => ({ ...base, color: '#4F46E5', padding: '2px 6px', fontSize: '14px' }),
                        multiValueRemove: (base) => ({
                          ...base,
                          color: '#4F46E5',
                          ':hover': { backgroundColor: '#E0E7FF', color: '#4338CA' },
                        }),
                        placeholder: (base) => ({ ...base, color: '#6B7280' }),
                        valueContainer: (base) => ({ ...base, padding: '2px 8px' }),
                        dropdownIndicator: (base, state) => ({
                          ...base,
                          color: state.isFocused ? '#4F46E5' : '#6B7280',
                          ':hover': { color: '#4F46E5' },
                          padding: '8px',
                        }),
                        clearIndicator: (base) => ({
                          ...base,
                          color: '#6B7280',
                          ':hover': { color: '#4F46E5' },
                          padding: '8px',
                        }),
                        indicatorSeparator: (base) => ({ ...base, backgroundColor: '#E5E7EB' }),
                      }}
                    />
                  </div>
                </div>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleGenerateChart}
                  className={`px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition duration-150 ease-in-out shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                    isGeneratingChart ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={isGeneratingChart || isLoading || isFetchingFiles}
                >
                  {isGeneratingChart ? 'Generating...' : 'Generate Chart'}
                </button>
                <button
                  onClick={handleGenerate3DChart}
                  className={`px-6 py-3 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition duration-150 ease-in-out shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${
                    isGeneratingChart ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={isGeneratingChart || isLoading || isFetchingFiles}
                >
                  {isGeneratingChart ? 'Generating...' : 'Generate 3D Chart'}
                </button>
              </div>
            </div>
          </div>
        )}
        {showChart && selectedFileData && (
                <ChartGenerator
                  selectedChart={selectedChart}
                  selectedXAxis={selectedXAxis}
                  selectedYAxes={selectedYAxes}
                  selectedFileData={selectedFileData}
                  isLoading={isLoading || isFetchingFiles}
            is3DMode={is3DMode}
                />
        )}
      </div>
    </div>
  );
};

export default FileUploadSection;