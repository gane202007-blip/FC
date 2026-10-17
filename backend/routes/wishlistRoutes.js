const express = require("express");
const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// @route   GET /api/wishlist
// @desc    Get logged in user's wishlist
router.get("/", protect, async (req, res) => {
    try {
        const wishlist = await Wishlist.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json({
            success: true,
            count: wishlist.length,
            wishlist
        });
    } catch (error) {
        console.error("Get wishlist error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch wishlist"
        });
    }
});

// @route   POST /api/wishlist
// @desc    Add a product to user's wishlist
router.post("/", protect, async (req, res) => {
    try {
        const productId = Number(req.body.productId);
        if (!Number.isSafeInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid product ID is required"
            });
        }

        const product = await Product.findOne({ id: productId });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Check if already in wishlist
        const existing = await Wishlist.findOne({ userId: req.user._id, productId });
        if (existing) {
            return res.json({
                success: true,
                message: "Product is already in your wishlist",
                wishlistItem: existing
            });
        }

        const wishlistItem = await Wishlist.create({
            userId: req.user._id,
            productId,
            product: {
                name: product.name,
                price: product.price,
                image: product.image,
                category: product.category,
                rating: product.rating
            }
        });

        res.status(201).json({
            success: true,
            message: "Added to wishlist",
            wishlistItem
        });
    } catch (error) {
        if (error.code === 11000) {
            const productId = Number(req.body.productId);
            const existing = await Wishlist.findOne({
                userId: req.user._id,
                productId
            });
            if (existing) {
                return res.json({
                    success: true,
                    message: "Product is already in your wishlist",
                    wishlistItem: existing
                });
            }
        }

        console.error("Add wishlist error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to add to wishlist"
        });
    }
});

// @route   DELETE /api/wishlist/:productId
// @desc    Remove product from wishlist
router.delete("/:productId", protect, async (req, res) => {
    try {
        const productId = Number(req.params.productId);
        if (!Number.isSafeInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid product ID is required"
            });
        }

        const result = await Wishlist.findOneAndDelete({
            userId: req.user._id,
            productId
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Item not found in wishlist"
            });
        }

        res.json({
            success: true,
            message: "Removed from wishlist"
        });
    } catch (error) {
        console.error("Remove wishlist item error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to remove from wishlist"
        });
    }
});

module.exports = router;
