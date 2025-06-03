import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import api from '../api/apiClient';

// Remove Mock API client
/*
const api = {
  get: async (url) => {
    // Simulate fetching name and email only
    return new Promise((resolve) =>
      setTimeout(() => resolve({ data: { name: 'Tejas', email: 't2@gmail.com' } }), 1000)
    );
  },
  put: async (url, data) => {
    // Simulate API call with a delay
    return new Promise((resolve) => setTimeout(() => resolve({ data: 'success' }), 1000));
  },
};
*/

const ProfileSection = ({ user, onLogout }) => {
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    birthday: user?.birthday || '',
    mobile: user?.mobile || '',
    address: user?.address || '',
    // profilePicture: user?.profilePicture || 'https://via.placeholder.com/150', // Removed profile picture
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  // const [imageFile, setImageFile] = useState(null); // Removed profile picture state
  // const [preview, setPreview] = useState(profile.profilePicture); // Removed profile picture state

  // Fetch initial profile data on component mount
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        // Use actual API client and endpoint for user profile
        const response = await api.auth.profile.get();
        console.log('Fetched profile data:', response.data); // Log fetched data
        setProfile(response.data);
        // setPreview(response.data.profilePicture || 'https://via.placeholder.com/150'); // Removed profile picture update
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
        let errorMessage = err.response?.data?.message || 'Failed to fetch profile data';
         if (err.response?.status === 401) {
            errorMessage = 'Session expired. Please log in again.';
            onLogout(); // Trigger logout if unauthorized
          }
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    // Fetch only if user prop is available (means authenticated)
    if(user) {
     fetchProfile();
    }
  }, [user, onLogout]); // Add user and onLogout to dependency array

  // Handle input changes for editable fields
  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  // Handle profile picture upload (Removed)
  /*
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
        setProfile((prev) => ({ ...prev, profilePicture: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };
  */

  // Reset form to initial state and exit edit mode
  const handleCancel = () => {
    // Refetch profile to reset to original values
    const fetchProfile = async () => {
        setLoading(true);
        try {
          const response = await api.auth.profile.get();
          setProfile(response.data);
        } catch (err) {
           console.error('Failed to refetch user profile on cancel:', err);
           let errorMessage = err.response?.data?.message || 'Failed to reset profile data';
           if (err.response?.status === 401) {
              errorMessage = 'Session expired. Please log in again.';
              onLogout();
            }
           toast.error(errorMessage);
        } finally {
          setLoading(false);
        }
      };
     if(user) {
        fetchProfile();
     }
    setIsEditing(false);
    toast('Changes discarded', {
      icon: '🔄',
    });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Use actual API client and endpoint for user profile update
      const { name, birthday, mobile, address } = profile; // Exclude email and profilePicture
      await api.auth.profile.update({ name, birthday, mobile, address });
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      // Refetch profile after update to ensure data is fresh
      if(user) {
         const response = await api.auth.profile.get();
         console.log('Refetched profile data after update:', response.data); // Log refetched data
         setProfile(response.data);
      }
    } catch (err) {
      console.error('Error updating user profile:', err);
      let errorMessage = err.response?.data?.message || 'Failed to update profile';
       if (err.response?.status === 401) {
          errorMessage = 'Session expired. Please log in again.';
          onLogout();
        }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mx-auto max-w-lg"> {/* Styled container */}
      <Toaster position="top-right" />
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Your Profile</h2> {/* Styled title */}
      {isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Full Name</label>
            <input
              type="text"
              name="name"
              value={profile.name}
              onChange={handleChange}
              className="w-full mt-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out shadow-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Email Address</label>
            <input
              type="email"
              name="email"
              value={profile.email}
              className="w-full mt-1 p-3 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed shadow-sm"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Birthday</label>
            <input
              type="date"
              name="birthday"
              value={profile.birthday ? new Date(profile.birthday).toISOString().split('T')[0] : ''}
              onChange={(e) => handleChange(e)}
              max={new Date().toISOString().split('T')[0]} // Add max attribute for birthday validation
              className="w-full mt-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Mobile Number</label>
            <input
              type="tel"
              name="mobile"
              value={profile.mobile || ''}
              onChange={(e) => handleChange(e)}
              className="w-full mt-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out shadow-sm"
              placeholder="Enter your mobile number"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Address</label>
            <input
              type="text"
              name="address"
              value={profile.address || ''}
              onChange={(e) => handleChange(e)}
              className="w-full mt-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out shadow-sm"
              placeholder="Enter your address"
            />
          </div>
          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 py-3 rounded-md font-semibold text-white transition duration-150 ease-in-out shadow-sm ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'}`}
            >
              {loading ? 'Updating...' : 'Update Profile'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-3 rounded-md font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition duration-150 ease-in-out shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
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
            className="mt-6 w-auto px-6 py-3 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition duration-150 ease-in-out shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Edit Profile
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileSection;