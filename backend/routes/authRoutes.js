const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "30d"
    });
};

// @route   POST /api/auth/register
// @desc    Register a new user
router.post("/register", async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields (name, email, password)"
            });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "An account with this email already exists"
            });
        }

        const user = await User.create({
            name,
            email: email.toLowerCase(),
            phone: phone || "",
            password
        });

        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: "Registration successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Registration failed"
        });
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide both email and password"
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const token = generateToken(user._id);

        res.json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Login failed"
        });
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Generate password reset OTP
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Please provide your registered email"
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No user found with this email address"
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetOtp = otp;
        user.resetOtpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await user.save();

        res.json({
            success: true,
            message: "OTP sent successfully. Please check your email (or use demo code).",
            otp: process.env.NODE_ENV === "development" ? otp : undefined
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to process forgot password request"
        });
    }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP for password reset
router.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required"
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase(),
            resetOtp: otp,
            resetOtpExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP"
            });
        }

        res.json({
            success: true,
            message: "OTP verified successfully"
        });
    } catch (error) {
        console.error("Verify OTP error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to verify OTP"
        });
    }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password using verified OTP
router.post("/reset-password", async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Email, OTP, and new password are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase(),
            resetOtp: otp,
            resetOtpExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP"
            });
        }

        user.password = newPassword;
        user.resetOtp = null;
        user.resetOtpExpire = null;
        await user.save();

        res.json({
            success: true,
            message: "Password has been reset successfully. You can now log in."
        });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to reset password"
        });
    }
});

// @route   GET /api/auth/me
// @desc    Get currently logged in user info
router.get("/me", protect, async (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            role: req.user.role
        }
    });
});

module.exports = router;
