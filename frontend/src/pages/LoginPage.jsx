import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/apiClient'; // Correctly imports the structured API client
import { RiUserLine, RiLockPasswordLine, RiEyeLine, RiEyeOffLine, RiMailLine } from 'react-icons/ri'; // Import icons

export default function LoginPage({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isMounted, setIsMounted] = useState(false); // State for animation

  // Set mounted state on component mount
  useState(() => {
    setIsMounted(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // Correct: Using api.auth.login
      const res = await api.auth.login({ email, password });
      onLoginSuccess(res.data.user);
      setSuccess('Login successful!');
      setTimeout(() => {
        navigate(res.data.user.role === 'admin' ? '/admin' : '/user/upload');
      }, 100);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Could not connect to server.');
      console.error("Login error:", err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6 overflow-hidden"> {/* Subtle gray background */}
      <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-2xl flex flex-col md:flex-row overflow-hidden"> {/* Soft rounded corners, larger shadow */}
        {/* Image Side (Left on Desktop) */}
        <div className="hidden md:flex w-1/2 bg-gradient-to-br from-blue-500 to-indigo-600 p-8 items-center justify-center"> {/* Professional gradient */}
          <div className="text-center text-white">
            {/* Replace with a more professional SVG or image */} {/* Example professional SVG */}
            <svg className="w-40 h-40 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            <h2 className="text-3xl font-bold mt-8">Unlock Your Data Insights</h2>
            <p className="text-indigo-100 mt-2 text-sm">Visualize, analyze, and manage your data effectively.</p>
          </div>
        </div>

        {/* Form Side (Right on Desktop) */}
        <div className={`w-full md:w-1/2 p-8 md:p-12 transition-transform duration-700 ease-out ${isMounted ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'}`}> {/* Refined transition, adjusted padding */}
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            {/* Optional: Add a smaller, subtle logo here if desired */}
          </div>

          {/* Welcome Text */}
          <h2 className="text-3xl font-bold mb-2 text-center text-gray-800">Welcome Back</h2>
          <p className="text-gray-600 mb-8 text-center text-md">Sign in to your account</p>

          {/* Error/Success Messages */}
          {error && <p className="text-red-500 mb-4 text-center text-sm font-medium">{error}</p>} {/* Adjusted red shade */}
          {success && <p className="text-green-500 mb-4 text-center text-sm font-medium">{success}</p>} {/* Adjusted green shade */}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 sr-only">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500"> {/* Slightly darker icon color */}
                  <RiUserLine className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  placeholder="Email Address"
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-800 placeholder-gray-500" // Adjusted border and focus ring color, placeholder color
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 sr-only">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500"> {/* Slightly darker icon color */}
                  <RiLockPasswordLine className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-800 placeholder-gray-500" // Adjusted border and focus ring color, placeholder color
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none" // Slightly darker icon colors
                >
                  {showPassword ? <RiEyeOffLine className="h-5 w-5" /> : <RiEyeLine className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Remember me / Forgot Password */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" /> {/* Blue checkbox */}
                <label htmlFor="remember-me" className="ml-2 block text-gray-700 font-medium">Remember me</label> {/* Slightly lighter text */}
              </div>
              <a href="#" className="font-medium text-blue-600 hover:text-blue-500">Forgot Password?</a> {/* Blue link */}
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out mt-6" // Professional blue/indigo gradient button
            >
              Login
            </button>

            {/* Sign Up Link */}
            <p className="mt-6 text-center text-gray-600 text-sm">
              Don't have an account?{' '}
              <span
                onClick={() => navigate('/register')}
                className="font-semibold text-blue-600 hover:text-blue-500 cursor-pointer ml-1" // Blue link
              >
                Sign up
              </span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}