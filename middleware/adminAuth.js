/**
 * Middleware to restrict route access to Admin users only.
 * Must be used AFTER the base 'auth' middleware.
 */
const adminAuth = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Access Denied: Only the developer/admin can perform this action.'
        });
    }
    next();
};

module.exports = adminAuth;
