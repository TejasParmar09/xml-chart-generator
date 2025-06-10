import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate, useParams } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import api from '../api/apiClient';
import { RiGroupLine, RiFileLine, RiUserLine, RiDashboardLine, RiRefreshLine, RiProfileLine, RiSettings5Line } from 'react-icons/ri';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const AdminPanel = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);
  const isFetchingRef = useRef(false);

  const [auth, setAuth] = useState({
    isAuthenticated: !!user,
    userRole: user?.role || '',
    loading: true,
  });

  const [adminData, setAdminData] = useState({
    users: [],
    userFiles: [],
    stats: {},
    recentUsers: [],
    recentFiles: [],
    registrationTrends: [],
    fileTypeDistribution: [],
    selectedUser: null,
    loading: false,
  });

  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    birthday: user?.birthday || '',
    mobile: user?.mobile || '',
    address: user?.address || '',
    profilePicture: user?.profilePicture || '',
  });

  const [uiState, setUiState] = useState({
    isDropdownOpen: false,
    activeMenuItem: 'dashboard',
  });

  const lastErrorRef = useRef(null);

  const showErrorToast = useCallback((message, details = {}) => {
    console.error('Fetch error:', { message, details });
    if (lastErrorRef.current !== message) {
      toast.error(message);
      lastErrorRef.current = message;
    }
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      console.log('Checking auth status via /api/auth/me');
      const res = await api.auth.me();
      console.log('Auth status response:', res.data);
      if (res.data.user && res.data.user.role === 'admin') {
        setAuth({
          isAuthenticated: true,
          userRole: res.data.user.role,
          loading: false,
        });
        setProfile({
          name: res.data.user.name || '',
          email: res.data.user.email || '',
          birthday: res.data.user.birthday || '',
          mobile: res.data.user.mobile || '',
          address: res.data.user.address || '',
          profilePicture: res.data.user.profilePicture || '',
        });
      } else {
        throw new Error('Not an admin user');
      }
    } catch (err) {
      const errorDetails = {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
      };
      let errorMessage = err.response?.data?.message || 'Session invalid. Please log in again.';
      if (err.response?.status === 404) {
        errorMessage = 'Backend server not found. Please ensure the server is running on http://localhost:5000.';
      }
      showErrorToast(errorMessage, errorDetails);
      setAuth((prev) => ({ ...prev, loading: false }));
      if (err.response?.status === 401) {
        onLogout();
        navigate('/login', { replace: true });
      }
    }
  }, [navigate, onLogout, showErrorToast]);

  const fetchAdminData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setAdminData((prev) => ({ ...prev, loading: true }));
    try {
      console.log('Starting fetchAdminData...');

      // Fetch All Users for User Management
      console.log('Fetching all users for User Management...');
      const usersRes = await api.admin.users.getAll();
      console.log('All users fetched:', usersRes.data);

      // Fetch Stats
      console.log('Fetching dashboard stats...');
      const statsRes = await api.admin.dashboard.getStats();
      console.log('Stats fetched:', statsRes.data);

      // Fetch Recent Users
      console.log('Fetching recent users...');
      const recentUsersRes = await api.admin.dashboard.getRecentUsers();
      console.log('Recent users fetched:', recentUsersRes.data);

      // Fetch Recent Files
      console.log('Fetching recent files...');
      const recentFilesRes = await api.admin.dashboard.getRecentFiles();
      console.log('Recent files fetched:', recentFilesRes.data);

      // Fetch Registration Trends
      console.log('Fetching registration trends...');
      const trendsRes = await api.admin.dashboard.getRegistrationTrends();
      console.log('Registration trends fetched:', trendsRes.data);

      // Fetch File Type Distribution
      console.log('Fetching file type distribution...');
      const distributionRes = await api.admin.dashboard.getFileTypeDistribution();
      console.log('File type distribution fetched:', distributionRes.data);

      setAdminData((prev) => ({
        ...prev,
        users: usersRes.data.users || [],
        stats: statsRes.data || {},
        recentUsers: recentUsersRes.data.users || [],
        recentFiles: recentFilesRes.data.files || [],
        registrationTrends: trendsRes.data.trends || [],
        fileTypeDistribution: distributionRes.data.distribution || [],
        loading: false,
      }));
    } catch (err) {
      const errorDetails = {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
      };
      let errorMessage = err.response?.data?.message || 'Failed to fetch admin data';
      if (err.response?.status === 404) {
        errorMessage = 'Backend server not found. Please ensure the server is running on http://localhost:5000.';
      }
      showErrorToast(errorMessage, errorDetails);
      setAdminData((prev) => ({ ...prev, loading: false }));
      if (err.response?.status === 401) {
        onLogout();
        navigate('/login', { replace: true });
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [navigate, onLogout, showErrorToast]);

  const handleDeleteUser = useCallback(async (userId) => {
    try {
      console.log('Deleting user:', userId);
      await api.admin.users.delete(userId);
      toast.success('User deleted successfully');
      // Refresh the user list after deletion
      fetchAdminData();
    } catch (err) {
      const errorDetails = {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
      };
      console.error('Error deleting user:', errorDetails);
      const errorMessage = err.response?.data?.message || 'Failed to delete user';
      if (err.response?.status === 401) {
        toast.error(errorMessage);
        navigate('/login', { replace: true });
      } else {
        toast.error(errorMessage);
      }
    }
  }, [fetchAdminData, navigate, onLogout, showErrorToast]);

  const fetchUserFiles = useCallback(
    async (userId) => {
      if (!userId) {
        showErrorToast('Please select a user to view files');
        return;
      }
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setAdminData((prev) => ({ ...prev, loading: true }));
      try {
        console.log('Fetching user files for user ID:', userId);
        const res = await api.admin.files.getByUser(userId);
        console.log('User files response:', res.data);
        const processedFiles = (res.data.files || []).map((file) => ({
          id: file._id || file.id,
          filename: file.filename || 'Untitled File',
          uploadDate: file.uploadDate || file.createdAt,
          size: file.size,
          type: file.type || 'xml',
          gridfsId: file.gridfsId, // Include gridfsId for navigation
        }));
        setAdminData((prev) => ({
          ...prev,
          userFiles: processedFiles,
          selectedUser: userId,
          loading: false,
        }));
        navigate('/admin/files');
      } catch (err) {
        const errorDetails = {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
        };
        let errorMessage = err.response?.data?.message || 'Failed to fetch user files';
        if (err.response?.status === 404) {
          errorMessage = 'Backend server not found. Please ensure the server is running on http://localhost:5000.';
        }
        showErrorToast(errorMessage, errorDetails);
        setAdminData((prev) => ({ ...prev, userFiles: [], loading: false }));
        if (err.response?.status === 401) {
          onLogout();
          navigate('/login', { replace: true });
        }
      } finally {
        isFetchingRef.current = false;
      }
    },
    [navigate, onLogout, showErrorToast]
  );

  const fetchProfile = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      console.log('Fetching admin profile');
      const res = await api.admin.profile.get();
      console.log('Profile response:', res.data);
      setProfile(res.data);
    } catch (err) {
      const errorDetails = {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
      };
      let errorMessage = err.response?.data?.message || 'Admin profile not found.';
      if (err.response?.status === 404) {
        errorMessage = 'Backend server not found. Please ensure the server is running on http://localhost:5000.';
      }
      showErrorToast(errorMessage, errorDetails);
      if (err.response?.status === 401) {
        onLogout();
        navigate('/login', { replace: true });
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [navigate, onLogout, showErrorToast]);

  const handleLogout = useCallback(async () => {
    try {
      console.log('Logging out');
      await api.auth.logout();
      onLogout();
      toast.success('Logged out successfully');
      navigate('/login', { replace: true });
    } catch (err) {
      const errorDetails = {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
      };
      showErrorToast(err.response?.data?.message || 'Failed to logout', errorDetails);
    }
  }, [navigate, onLogout, showErrorToast]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setUiState((prev) => ({ ...prev, isDropdownOpen: false }));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  useEffect(() => {
    if (auth.isAuthenticated && auth.userRole === 'admin') {
      fetchAdminData();
      fetchProfile();
    }
  }, [auth.isAuthenticated, auth.userRole, fetchAdminData, fetchProfile]);

  useEffect(() => {
    if (location.pathname === '/admin' || location.pathname === '/admin/') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [location.pathname, navigate]);

  const menuItems = useMemo(
    () => [
      { path: 'dashboard', label: 'Dashboard', icon: <RiDashboardLine className="h-6 w-6" /> },
      { path: 'users', label: 'User Management', icon: <RiGroupLine className="h-6 w-6" /> },
      { path: 'files', label: 'User Files', icon: <RiFileLine className="h-6 w-6" /> },
      { path: 'profile', label: 'Profile', icon: <RiUserLine className="h-6 w-6" /> },
    ],
    []
  );

  const isActiveRoute = useCallback(
    (path) => location.pathname === `/admin/${path}`,
    [location.pathname]
  );

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-teal-600"></div>
      </div>
    );
  }

  if (!auth.isAuthenticated || auth.userRole !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="flex flex-col w-64 bg-indigo-900 text-white shadow-xl">
        <div className="flex items-center justify-center h-16 border-b border-indigo-800">
          <span className="text-2xl font-semibold text-white">Admin Panel</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-3">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={`/admin/${item.path === 'dashboard' ? '' : item.path}`}
              className={`flex items-center px-3 py-2 rounded-md transition-colors ${isActiveRoute(item.path) ? 'bg-blue-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
              onClick={() => setUiState(prev => ({ ...prev, activeMenuItem: item.path }))}
            >
              <span className="mr-3 h-6 w-6 text-blue-400">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
          <button
            onClick={fetchAdminData}
            className="flex items-center w-full text-left px-3 py-2 rounded-md transition-colors text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <RiRefreshLine className="mr-3 h-6 w-6 text-blue-400" />
            <span className="font-medium">Refresh Data</span>
          </button>
        </nav>
      </div>

      <div className="flex-1 p-8">
        <Toaster position="top-right" />
        <Routes>
          <Route path="dashboard" element={<Dashboard stats={adminData.stats} loading={adminData.loading} />} />
          <Route
            path="users"
            element={
              <UserManagement
                users={adminData.users}
                onSelectUser={fetchUserFiles}
                selectedUser={adminData.selectedUser}
                loading={adminData.loading}
                onDeleteUser={handleDeleteUser}
              />
            }
          />
          <Route
            path="files"
            element={
              <FileManagement
                files={adminData.userFiles}
                loading={adminData.loading}
                onFileDeleteSuccess={fetchUserFiles}
                selectedUser={adminData.selectedUser}
              />
            }
          />
          <Route
            path="files/:userId"
            element={<UserFilesRoute fetchUserFiles={fetchUserFiles} />}
          />
          <Route
            path="profile"
            element={<ProfileManagement profile={profile} onUpdate={fetchProfile} />}
          />
          <Route path="files/:id" element={<FileDetailsPage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
};

// New component to handle /admin/files/:userId route
const UserFilesRoute = ({ fetchUserFiles }) => {
  const { userId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (userId) {
      fetchUserFiles(userId);
    } else {
      navigate('/admin/users', { replace: true });
    }
  }, [userId, fetchUserFiles, navigate]);

  return null; // This component only triggers fetchUserFiles and redirects
};

const Dashboard = ({ stats, loading }) => {
  const statCards = [
    { label: 'Total Users', value: stats.totalUsers || 0, icon: <RiGroupLine /> },
    { label: 'Total Files', value: stats.totalFiles || 0, icon: <RiFileLine /> },
    { label: 'Admin Users', value: stats.adminUsersCount || 0, icon: <RiUserLine /> },
    { label: 'Regular Users', value: stats.regularUsersCount || 0, icon: <RiUserLine /> },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
      {loading && <p className="text-blue-600">Loading stats...</p>}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-lg shadow-md p-6 flex items-center space-x-4">
              <div className="flex-shrink-0 p-3 bg-blue-500 text-white rounded-full">
                {React.cloneElement(card.icon, { className: 'h-6 w-6' })}
              </div>
              <div>
                <p className="text-gray-500 text-sm font-medium">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const UserManagement = ({ users, onSelectUser, selectedUser, loading, onDeleteUser }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b border-gray-200 pb-4">User Management</h2>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 border-opacity-50"></div>
        </div>
      ) : (
        <div className="space-y-5">
          {users.length > 0 ? (
            users.map((user) => (
              <div key={user._id} className="flex items-center justify-between border border-gray-200 rounded-lg px-6 py-4 shadow-sm transition-all duration-200 bg-white hover:shadow-md hover:border-blue-300">
                <div className="flex-1 pr-4">
                  <div>
                    <p className="font-semibold text-gray-800 text-lg">{user.name}</p>
                    <p className="text-sm text-gray-600 mt-1 font-mono">{user.email}</p>
                    <p className="text-sm text-gray-600">Role: {user.role}</p>
                    <div className="flex text-xs text-gray-500 mt-2 space-x-4">
                      <span>Created: {new Date(user.createdAt).toLocaleDateString()}</span>
                      <span>Last Updated: {new Date(user.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <Link
                    to={`/admin/files/${user._id}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-200 shadow-sm font-medium"
                    onClick={() => onSelectUser(user._id)}
                  >
                    View Files
                  </Link>
                  <button
                    onClick={() => onDeleteUser(user._id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all duration-200 shadow-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-8 text-lg">No users found</p>
          )}
        </div>
      )}
    </div>
  );
};

const FileManagement = ({ files, loading, onFileDeleteSuccess, selectedUser }) => {
  const navigate = useNavigate();
  const handleDelete = async (fileId) => {
    try {
      console.log('Deleting file:', fileId);
      await api.admin.files.delete(fileId);
      toast.success('File deleted successfully');
      if (selectedUser) {
        onFileDeleteSuccess(selectedUser);
      }
    } catch (err) {
      const errorDetails = {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
      };
      console.error('Error deleting file:', errorDetails);
      const errorMessage = err.response?.data?.message || 'Failed to delete file';
      if (err.response?.status === 401) {
        toast.error(errorMessage);
        navigate('/login', { replace: true });
      } else {
        toast.error(errorMessage);
      }
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b border-gray-200 pb-4">File Management</h2>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {files.length > 0 ? (
            files.map((file) => (
              <div
                key={file.id}
                className="flex justify-between items-center border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 bg-white hover:border-blue-300"
              >
                <div>
                  <p className="font-medium text-gray-900">{file.filename}</p>
                  <p className="text-sm text-gray-600 font-mono">
                    {new Date(file.uploadDate).toLocaleString()}
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all duration-200 shadow-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-8">
              No files found. Please select a user to view their files.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const ProfileManagement = ({ profile, onUpdate }) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(profile);

  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      console.log('Updating profile with data:', formData);
      await api.admin.profile.update(formData);
      onUpdate();
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (err) {
      const errorDetails = {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
      };
      console.error('Error updating profile:', errorDetails);
      const errorMessage = err.response?.data?.message || 'Failed to update profile';
      if (err.response?.status === 401) {
        toast.error(errorMessage);
        navigate('/login', { replace: true });
      } else {
        toast.error(errorMessage);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-10">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Admin Profile</h2>
        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                disabled
                className="w-full mt-1 p-3 border border-gray-300 rounded-lg bg-gray-200 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700">Birthday</label>
              <input
                type="date"
                name="birthday"
                value={formData.birthday ? new Date(formData.birthday).toISOString().split('T')[0] : ''}
                onChange={handleChange}
                className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700">Mobile Number</label>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile || ''}
                onChange={handleChange}
                className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter your mobile number"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700">Address</label>
              <input
                type="text"
                name="address"
                value={formData.address || ''}
                onChange={handleChange}
                className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter your address"
              />
            </div>
            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                className={`flex-1 py-3 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition`}
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 py-3 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700">Full Name</label>
              <p className="w-full mt-1 p-3 border border-gray-300 rounded-lg bg-gray-50">
                {profile.name || 'Not provided'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700">Email Address</label>
              <p className="w-full mt-1 p-3 border border-gray-300 rounded-lg bg-gray-50">
                {profile.email || 'Not provided'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700">Birthday</label>
              <p className="w-full mt-1 p-3 border border-gray-300 rounded-lg bg-gray-50">
                {profile.birthday ? new Date(profile.birthday).toLocaleDateString() : 'Not provided'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700">Mobile Number</label>
              <p className="w-full mt-1 p-3 border border-gray-300 rounded-lg bg-gray-50">
                {profile.mobile || 'Not provided'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700">Address</label>
              <p className="w-full mt-1 p-3 border border-gray-300 rounded-lg bg-gray-50">
                {profile.address || 'Not provided'}
              </p>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="mt-6 w-auto px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
              Edit Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const FileDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFileDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching file details for ID:', id);
        const [fileRes, contentRes] = await Promise.all([
          api.admin.files.getById(id),
          api.admin.files.getContent(id),
        ]);
        console.log('File details response:', fileRes.data);
        console.log('File content response:', contentRes.data);
        if (!fileRes.data) {
          throw new Error('No file data returned from server.');
        }
        setFile({
          id: fileRes.data._id || fileRes.data.id,
          filename: fileRes.data.filename || 'Untitled File',
          uploadDate: fileRes.data.uploadDate || fileRes.data.createdAt,
          size: fileRes.data.size,
          type: fileRes.data.type || 'xml',
        });
        setContent(contentRes.data.data || 'No content available.');
      } catch (err) {
        const errorDetails = {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          request: {
            url: err.config?.url,
            method: err.config?.method,
            params: err.config?.params,
          },
        };
        console.error('Error fetching file details/content:', errorDetails);
        const errorMessage = err.response?.data?.message || `Failed to load file details for ID ${id}.`;
        setError(errorMessage);
        toast.error(errorMessage);
        if (err.response?.status === 401) {
          navigate('/login', { replace: true });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchFileDetails();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-teal-600"></div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="bg-white rounded-xl shadow-2xl px-8 pb-8 pt-6 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-indigo-800 mb-6 border-b-2 border-indigo-200 pb-2">File Details</h2>
        <button
          onClick={() => navigate(-1)}
          className="mb-6 px-6 py-2 bg-gray-200 text-gray-700 rounded-full font-semibold hover:bg-gray-300 transition-all duration-200 shadow"
        >
          ← Back to User Files
        </button>
        <p className="text-center text-red-600 text-lg font-semibold py-8">{error || 'File not found'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl px-8 pb-8 pt-6">
        <h2 className="text-3xl font-bold text-indigo-800 mb-6 border-b-2 border-indigo-200 pb-2">File Details</h2>
        <button
          onClick={() => navigate(-1)}
          className="mb-6 px-6 py-2 bg-gray-200 text-gray-700 rounded-full font-semibold hover:bg-gray-300 transition-all duration-200 shadow"
        >
          ← Back to User Files
        </button>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border-b pb-4">
              <p className="text-sm font-medium text-gray-700">Filename</p>
              <p className="mt-1 text-gray-900 text-lg font-semibold">{file.filename}</p>
            </div>
            <div className="border-b pb-4">
              <p className="text-sm font-medium text-gray-700">Upload Date</p>
              <p className="mt-1 text-gray-900">{new Date(file.uploadDate).toLocaleString()}</p>
            </div>
            <div className="border-b pb-4">
              <p className="text-sm font-medium text-gray-700">File Size</p>
              <p className="mt-1 text-gray-900">{file.size ? `${(file.size / 1024).toFixed(2)} KB` : 'Unknown'}</p>
            </div>
            <div className="border-b pb-4">
              <p className="text-sm font-medium text-gray-700">File Type</p>
              <p className="mt-1 text-gray-900">{file.type}</p>
            </div>
          </div>
          <div>
            <p className="text-lg font-bold text-indigo-800 mb-3 border-b-2 border-indigo-200 pb-2">Content</p>
            <pre className="mt-1 bg-gray-100 p-4 rounded-xl overflow-auto max-h-96 whitespace-pre-wrap break-words text-sm leading-relaxed shadow-inner">
              {content}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;