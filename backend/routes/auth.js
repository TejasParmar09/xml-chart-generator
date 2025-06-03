const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Enhanced validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please fill all required fields (name, email, password)' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Set default role if not provided or invalid
    const newUserRole = role && ['admin', 'user'].includes(role) ? role : 'user';

    // Create new user
    user = new User({ name, email, password, role: newUserRole });
    await user.save();

    // Automatically log in the user after successful registration
    req.session.user = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    console.log('Session set after registration:', req.session.user);

    // Ensure session is saved before sending response
    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Error saving session after registration' });
      }
      res.status(201).json({ message: 'User registered successfully and logged in.', user: req.session.user });
    });
  } catch (err) {
    console.error('Error during registration:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(err.errors)[0].message });
    }
    res.status(500).json({ message: 'Server error during registration', error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Update lastLogin timestamp
    user.lastLogin = new Date();
    await user.save();

    req.session.user = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    console.log('Session set on login:', req.session.user);

    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Error saving session after login' });
      }
      res.status(200).json({ message: 'Logged in successfully', user: req.session.user });
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

router.get('/me', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

router.get('/profile', authMiddleware.auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
});

router.put('/profile', authMiddleware.auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, birthday, mobile, address } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, birthday, mobile, address },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(updatedUser);
  } catch (err) {
    console.error('Error updating user profile:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error updating profile' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: 'Could not log out, please try again' });
    }
    res.clearCookie('connect.sid', { httpOnly: true, secure: false, sameSite: 'Lax' });
    res.status(200).json({ message: 'Logged out successfully' });
  });
});

module.exports = router;