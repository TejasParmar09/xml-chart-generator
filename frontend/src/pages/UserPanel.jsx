import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import FileUploadSection from '../components/FileUploadSection';
import UploadedFileSection from '../components/UploadedFilesSection';
import ProfileSection from '../components/ProfileSection';
import FileDetailsPage from '../components/FileDetailsPage'; // Import FileDetailsPage
import Navbar from '../components/Navbar';
import api from '../api/apiClient';

export default function UserPanel({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthenticated = !!user;
  const userRole = user?.role;

  const [state, setState] = useState({
    xmlFiles: [],
    isLoadingFiles: false,
    error: null,
    lastErrorMessage: null,
  });

  // --- Handle File Deletion ---
  const handleFileDeleted = useCallback((gridfsId) => {
    setState(prev => ({
      ...prev,
      xmlFiles: prev.xmlFiles.filter(file => file.gridfsId !== gridfsId),
    }));
    // No need to re-fetch the entire list here, state is updated directly
  }, []);

  // --- Authentication and Redirection Logic (Internal to UserPanel) ---
  useEffect(() => {
    if (!isAuthenticated) {
      toast.error('Session invalid. Please log in again.');
      onLogout();
      navigate('/login', { replace: true });
      return;
    }
    if (userRole !== 'user') {
      toast.warn('Access denied. Redirecting.');
      navigate(userRole === 'admin' ? '/admin' : '/login', { replace: true });
      return;
    }

    if (location.pathname === '/user' || location.pathname === '/user/') {
      navigate('/user/file-upload', { replace: true });
    }
  }, [isAuthenticated, userRole, location.pathname, navigate, onLogout]);

  // --- Fetch XML Files Logic ---
  const fetchXmlFiles = useCallback(async () => {
    if (!isAuthenticated || userRole !== 'user') {
      console.log('User not authenticated or not a "user" role. Skipping file fetch.');
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoadingFiles: true, error: null, lastErrorMessage: null }));
      console.log('Fetching XML files for current user...');
      const response = await api.userFiles.getAll();
      const processedFiles = (response.data.files || []).map((file) => ({
        id: file._id || file.id,
        name: file.name || file.filename || 'Untitled File',
        uploadDate: file.uploadDate || file.createdAt,
        size: file.size,
        type: file.type || 'xml',
        gridfsId: file.gridfsId,
      }));

      setState((prev) => ({
        ...prev,
        xmlFiles: processedFiles,
        isLoadingFiles: false,
        error: null,
        lastErrorMessage: null,
      }));
    } catch (error) {
      console.error('Error fetching files:', error);
      let errorMessage = 'Failed to load files. Please try again later.';

      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = error.response.data?.message || 'Session expired. Please log in again.';
          if (state.lastErrorMessage !== errorMessage) {
            toast.error(errorMessage);
            setState((prev) => ({ ...prev, lastErrorMessage: errorMessage }));
          }
          onLogout();
          return;
        } else if (error.response.status === 403) {
          errorMessage = error.response.data?.message || 'You do not have permission to view files.';
        } else if (error.response.status === 404) {
          errorMessage = error.response.data?.message || 'No files found.';
        }
      } else if (error.request) {
        errorMessage = 'Network error: Could not connect to the server.';
      } else {
        errorMessage = error.message || 'An unexpected error occurred while fetching files.';
      }

      if (state.lastErrorMessage !== errorMessage) {
        toast.error(errorMessage);
        setState((prev) => ({ ...prev, lastErrorMessage: errorMessage }));
      }
      setState((prev) => ({
        ...prev,
        xmlFiles: [],
        isLoadingFiles: false,
        error: errorMessage,
      }));
    }
  }, [isAuthenticated, userRole, onLogout, state.lastErrorMessage]);

  useEffect(() => {
    if (isAuthenticated && userRole === 'user') {
      fetchXmlFiles();
    }
  }, [fetchXmlFiles, isAuthenticated, userRole]);

  // --- Menu Items and Active Route Determination ---
  const menuItems = useMemo(
    () => [
      {
        path: 'file-upload',
        label: 'File Upload',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        ),
      },
      {
        path: 'uploaded-files',
        label: 'Uploaded Files',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
      {
        path: 'profile',
        label: 'Profile',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ),
      },
    ],
    []
  );

  const isActiveRoute = useCallback(
    (path) => location.pathname === `/user/${path}`,
    [location.pathname]
  );

  if (!isAuthenticated || userRole !== 'user') {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="flex flex-col w-64 bg-blue-800 text-white shadow-xl flex-shrink-0">
        <div className="flex items-center justify-center h-16 border-b border-blue-700">
          <span className="text-2xl font-semibold text-white">User Panel</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-3 overflow-y-auto">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={`/user/${item.path}`}
              className={`flex items-center px-3 py-2 rounded-md transition-colors ${isActiveRoute(item.path) ? 'bg-blue-600 text-white shadow-md' : 'text-gray-300 hover:bg-blue-700 hover:text-white'}`}
            >
              <span className="mr-3 h-6 w-6 text-blue-300">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
              {item.path === 'uploaded-files' && state.xmlFiles.length > 0 && (
                <span className="ml-auto inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-semibold rounded-full shadow">
                  {state.xmlFiles.length}
                </span>
              )}
            </Link>
          ))}
          <button
            onClick={fetchXmlFiles}
            className="flex items-center w-full text-left px-3 py-2 rounded-md transition-colors text-gray-300 hover:bg-blue-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={state.isLoadingFiles}
          >
            {state.isLoadingFiles ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
            ) : (
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span className="font-medium">Refresh Files</span>
          </button>
        </nav>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <Routes>
          <Route index element={<Navigate to="file-upload" replace />} />
          <Route path="file-upload" element={<FileUploadSection onFileUploadSuccess={fetchXmlFiles} />} />
          <Route
            path="uploaded-files"
            element={
              <UploadedFileSection
                files={state.xmlFiles}
                isLoading={state.isLoadingFiles}
                error={state.error}
                onFileDeleteSuccess={fetchXmlFiles}
                onFileDeleted={handleFileDeleted}
                userRole={userRole}
              />
            }
          />
          <Route path="profile" element={<ProfileSection user={user} />} />
          <Route path="files/:id" element={<FileDetailsPage />} />
          <Route
            path="*"
            element={
              <div className="text-center text-gray-500 mt-16">
                Please select a menu item to get started.
              </div>
            }
          />
        </Routes>
      </div>
    </div>
  );
}