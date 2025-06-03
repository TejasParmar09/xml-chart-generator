const auth = (req, res, next) => {
    console.log('Session in auth middleware:', req.session);
    if (!req.session || !req.session.user) {
        return res.status(401).json({ message: "Not authenticated, please log in." });
    }
    req.user = req.session.user;
    next();
};

const adminAuth = (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied: Admins only." });
    }
    next();
};

module.exports = {
    auth,
    adminAuth
};