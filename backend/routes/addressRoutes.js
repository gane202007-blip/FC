const express = require("express");
const Address = require("../models/Address");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// @route   GET /api/address
// @desc    Get all saved addresses for logged-in user
router.get("/", protect, async (req, res) => {
    try {
        const addresses = await Address.find({ userId: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
        res.json({
            success: true,
            count: addresses.length,
            addresses
        });
    } catch (error) {
        console.error("Get addresses error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch addresses"
        });
    }
});

// @route   POST /api/address
// @desc    Add a new address
router.post("/", protect, async (req, res) => {
    try {
        const { fullName, phone, street, city, state, pincode, type, isDefault } = req.body;

        if (!fullName || !phone || !street || !city || !state || !pincode) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required address fields"
            });
        }

        const addressCount = await Address.countDocuments({ userId: req.user._id });
        const shouldBeDefault = isDefault || addressCount === 0;

        if (shouldBeDefault) {
            await Address.updateMany({ userId: req.user._id }, { isDefault: false });
        }

        const address = await Address.create({
            userId: req.user._id,
            fullName: fullName.trim(),
            phone: phone.trim(),
            street: street.trim(),
            city: city.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
            type: type || "Home",
            isDefault: shouldBeDefault
        });

        res.status(201).json({
            success: true,
            message: "Address added successfully",
            address
        });
    } catch (error) {
        console.error("Add address error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to add address"
        });
    }
});

// @route   PUT /api/address/:id
// @desc    Update an address
router.put("/:id", protect, async (req, res) => {
    try {
        const address = await Address.findOne({ _id: req.params.id, userId: req.user._id });
        if (!address) {
            return res.status(404).json({
                success: false,
                message: "Address not found or not owned by user"
            });
        }

        const { fullName, phone, street, city, state, pincode, type, isDefault } = req.body;

        if (fullName) address.fullName = fullName.trim();
        if (phone) address.phone = phone.trim();
        if (street) address.street = street.trim();
        if (city) address.city = city.trim();
        if (state) address.state = state.trim();
        if (pincode) address.pincode = pincode.trim();
        if (type) address.type = type;

        if (isDefault) {
            await Address.updateMany({ userId: req.user._id }, { isDefault: false });
            address.isDefault = true;
        }

        await address.save();

        res.json({
            success: true,
            message: "Address updated successfully",
            address
        });
    } catch (error) {
        console.error("Update address error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update address"
        });
    }
});

// @route   PUT /api/address/:id/default
// @desc    Set address as default
router.put("/:id/default", protect, async (req, res) => {
    try {
        const address = await Address.findOne({ _id: req.params.id, userId: req.user._id });
        if (!address) {
            return res.status(404).json({
                success: false,
                message: "Address not found"
            });
        }

        await Address.updateMany({ userId: req.user._id }, { isDefault: false });
        address.isDefault = true;
        await address.save();

        res.json({
            success: true,
            message: "Default address updated",
            address
        });
    } catch (error) {
        console.error("Set default address error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update default address"
        });
    }
});

// @route   DELETE /api/address/:id
// @desc    Delete an address
router.delete("/:id", protect, async (req, res) => {
    try {
        const address = await Address.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!address) {
            return res.status(404).json({
                success: false,
                message: "Address not found"
            });
        }

        // If the deleted address was default, make another one default if available
        if (address.isDefault) {
            const nextAddress = await Address.findOne({ userId: req.user._id });
            if (nextAddress) {
                nextAddress.isDefault = true;
                await nextAddress.save();
            }
        }

        res.json({
            success: true,
            message: "Address deleted successfully"
        });
    } catch (error) {
        console.error("Delete address error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to delete address"
        });
    }
});

module.exports = router;
