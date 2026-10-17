const express = require("express");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
router.get("/profile", protect, async (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            role: req.user.role,
            createdAt: req.user.createdAt
        }
    });
});

// @route   PUT /api/users/profile
// @desc    Update user profile
router.put("/profile", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (req.body.name) user.name = req.body.name.trim();
        if (req.body.phone !== undefined) user.phone = req.body.phone.trim();

        await user.save();

        res.json({
            success: true,
            message: "Profile updated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update profile"
        });
    }
});

module.exports = router;
