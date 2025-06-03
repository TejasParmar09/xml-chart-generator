const adminAuth = (req, res, next) => {
    console.log('adminAuth middleware: req.session', req.session);
    console.log('adminAuth middleware: req.session.user', req.session ? req.session.user : 'Session not found');
    if (req.session.user && req.session.user.role === 'admin') {
        req.user = req.session.user;
        next();
    } else {
        console.warn(`Attempted unauthorized admin access from user: ${req.session.user ? req.session.user.email : 'Unauthenticated'}`);
        res.status(403).json({ message: 'Access denied: Admins only' });
    }
};

module.exports = adminAuth;