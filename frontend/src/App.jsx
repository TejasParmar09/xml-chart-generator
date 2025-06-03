import { useState, useEffect, useCallback } from 'react'; // Import useCallback
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UserPanel from './pages/UserPanel';
import AdminPanel from './pages/AdminPanel';
import Navbar from './components/Navbar';
import api from './api/apiClient'; // Import your structured API client

export default function App() {
  const navigate = useNavigate();
  const location = useLocation(); // Get current location
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Use useCallback for checkAuth to ensure it's stable across renders if used as a dependency
  const checkAuth = useCallback(async () => {
    try {
      const res = await api.auth.me();
      setUser(res.data.user);
    } catch (err) {
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []); // Empty dependency array means it's created once

  useEffect(() => {
    checkAuth();
  }, [checkAuth]); // Depend on the stable checkAuth function

  const handleLoginSuccess = useCallback((userData) => { // Use useCallback
    setUser(userData);
  }, []);

  const handleLogout = useCallback(async () => { // Use useCallback
    try {
      await api.auth.logout(); // Call the specific logout method from your API client
      setUser(null); // Clear the user state
      navigate('/login'); // Redirect to login page
    } catch (err) {
      console.error('Logout error:', err);
      // You might want a toast here for backend logout errors
      // toast.error('Logout failed on server. Please try again.');
    }
  }, [navigate]); // Depend on navigate

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading application...</p>
      </div>
    );
  }

  const isLoggedIn = !!user;

  return (
    <>
      <Toaster />
      {/* Conditionally render Navbar based on route */}
      {location.pathname !== '/login' && location.pathname !== '/register' && (
        <Navbar user={user} onLogout={handleLogout} />
      )}
      {/* Add padding-top to account for fixed Navbar, but only when Navbar is present */}
      <div className={location.pathname !== '/login' && location.pathname !== '/register' ? "pt-16" : ""}>
        <Routes>
          {/* Default route: Handles initial redirection based on auth status and role */}
          <Route
            path="/"
            element={
              !isLoggedIn ? (
                <Navigate to="/login" replace />
              ) : user?.role === 'admin' ? (
                <Navigate to="/admin" replace />
              ) : (
                // FIX: Redirect to the base /user path, UserPanel will handle the default sub-route
                <Navigate to="/user" replace />
              )
            }
          />

          {/* Login Route */}
          <Route
            path="/login"
            element={
              isLoggedIn ? (
                <Navigate to={user?.role === 'admin' ? '/admin' : '/user'} replace /> // FIX: Redirect to /user
              ) : (
                <LoginPage onLoginSuccess={handleLoginSuccess} />
              )
            }
          />

          {/* Register Route */}
          <Route
            path="/register"
            element={
              isLoggedIn ? (
                <Navigate to={user?.role === 'admin' ? '/admin' : '/user'} replace /> // FIX: Redirect to /user
              ) : (
                <RegisterPage />
              )
            }
          />

          {/* User Panel Routes (Protected) */}
          <Route
            path="/user/*" // Use /* to indicate nested routes within UserPanel
            element={
              isLoggedIn && user?.role === 'user' ? (
                <UserPanel user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Admin Panel Routes (Protected) */}
          <Route
            path="/admin/*" // Use /* to indicate nested routes within AdminPanel
            element={
              isLoggedIn && user?.role === 'admin' ? (
                <AdminPanel user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Catch-all for unmatched routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}