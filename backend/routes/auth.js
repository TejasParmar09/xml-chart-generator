const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const newUserRole = (role && (role === 'admin' || role === 'user')) ? role : 'user';
        user = new User({ name, email, password, role: newUserRole });
        await user.save();
        res.status(201).json({ message: 'User registered successfully. Please log in.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error during registration.' });
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
        res.status(200).json({ message: 'Logged in successfully', user: req.session.user });
    } catch (err) {
        res.status(500).json({ message: 'Server error during login.' });
    }
});

router.get('/me', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
});

// New route to fetch full user profile details
router.get('/profile', authMiddleware.auth, async (req, res) => {
    try {
        // Fetch user from the database using the authenticated user's ID
        const user = await User.findById(req.user._id).select('-password'); // Exclude password
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Return the full user profile details
        res.status(200).json(user);
    } catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).json({ message: 'Server error fetching profile.' });
    }
});

// New route to update user profile details
router.put('/profile', authMiddleware.auth, async (req, res) => {
    try {
        const userId = req.user._id;
        // Get the updated fields from the request body
        const { name, birthday, mobile, address } = req.body;

        // Find the user by ID and update the fields
        // Use findByIdAndUpdate with { new: true } to return the updated document
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { name, birthday, mobile, address },
            { new: true, runValidators: true } // Return updated doc, run schema validators
        ).select('-password'); // Exclude password from the response

        if (!updatedUser) {
            // This case should ideally not be reached if auth middleware works correctly
            return res.status(404).json({ message: 'User not found' });
        }

        // Return the updated user profile details
        res.status(200).json(updatedUser);

    } catch (err) {
        console.error('Error updating user profile:', err);
        // Handle validation errors or other database errors
        if (err.name === 'ValidationError') {
             return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Server error updating profile.' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Could not log out, please try again.' });
        }
        res.clearCookie('connect.sid', { httpOnly: true, secure: false, sameSite: 'Lax' });
        res.status(200).json({ message: 'Logged out successfully' });
    });
});

module.exports = router;