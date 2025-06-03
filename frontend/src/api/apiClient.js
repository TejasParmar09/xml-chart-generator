import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

const api = {
  auth: {
    login: (credentials) => apiClient.post('/auth/login', credentials),
    register: (userData) => apiClient.post('/auth/register', userData),
    me: () => apiClient.get('/auth/me'),
    logout: () => apiClient.post('/auth/logout'),
    profile: {
      get: () => apiClient.get('/auth/profile'),
      update: (data) => apiClient.put('/auth/profile', data),
    },
  },
  admin: {
    users: {
      getAll: () => apiClient.get('/admin/users'),
    },
    dashboard: {
      getStats: () => apiClient.get('/admin/dashboard/stats'),
      getRecentUsers: () => apiClient.get('/admin/recent-users'),
      getRecentFiles: () => apiClient.get('/admin/recent-files'),
      getRegistrationTrends: () => apiClient.get('/admin/registration-trends'),
      getFileTypeDistribution: () => apiClient.get('/admin/file-type-distribution'),
    },
    profile: {
      get: () => apiClient.get('/admin/profile'),
      update: (data) => apiClient.put('/admin/profile', data),
    },
    files: {
      getByUser: (userId) => apiClient.get(`/admin/user-files/${userId}`),
      getById: (fileId) => apiClient.get(`/admin/files/${fileId}`),
      getContent: (fileId) => apiClient.get(`/admin/files/${fileId}/content`),
      delete: (fileId) => apiClient.delete(`/admin/files/${fileId}`),
    },
  },
  userFiles: {
    upload: (formData) =>
      apiClient.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    getAll: () => apiClient.get('/files'),
    getDetails: (fileId) => apiClient.get(`/files/${fileId}`),
    getContent: (gridfsId) => apiClient.get(`/files/content/${gridfsId}`),
    download: (gridfsId) => apiClient.get(`/files/download/${gridfsId}`, { responseType: 'blob' }),
    delete: (gridfsId) => apiClient.delete(`/files/${gridfsId}`),
  },
};

export default api;