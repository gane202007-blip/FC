const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select("-password");

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "User not found or account removed"
                });
            }

            req.user = user;
            return next();
        } catch (error) {
            console.error("Auth middleware error:", error.message);
            return res.status(401).json({
                success: false,
                message: "Not authorized, token invalid or expired"
            });
        }
    }

    return res.status(401).json({
        success: false,
        message: "Not authorized, no token provided"
    });
};

const admin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Not authorized, authentication required"
        });
    }

    if (req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Admin privileges required."
        });
    }

    return next();
};

module.exports = { protect, admin };
