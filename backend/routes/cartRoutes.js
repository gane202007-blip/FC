const express = require("express");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const buildCartResponse = async cart => {
    const productIds = cart.items.map(item => item.productId);
    const products = await Product.find({ id: { $in: productIds } });
    const productsById = new Map(products.map(product => [product.id, product]));
    let cartChanged = false;

    const items = cart.items.map(item => {
        const product = productsById.get(item.productId);
        if (product) {
            for (const field of ["name", "price", "image", "category"]) {
                if (item[field] !== product[field]) {
                    item[field] = product[field];
                    cartChanged = true;
                }
            }
        }

        return {
            ...item.toObject(),
            stock: product ? product.stock : 0
        };
    });

    if (cartChanged) {
        await cart.save();
    }

    return {
        items,
        subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        count: items.reduce((sum, item) => sum + item.quantity, 0)
    };
};

// @route   GET /api/cart
// @desc    Get current user's cart
router.get("/", protect, async (req, res) => {
    try {
        let cart = await Cart.findOne({ userId: req.user._id });
        if (!cart) {
            cart = await Cart.create({ userId: req.user._id, items: [] });
        }

        const cartData = await buildCartResponse(cart);

        res.json({
            success: true,
            cart: cartData
        });
    } catch (error) {
        console.error("Get cart error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch cart"
        });
    }
});

// @route   POST /api/cart
// @desc    Add or update one item in the current user's cart
router.post("/", protect, async (req, res) => {
    try {
        const { items, item } = req.body;
        if (Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                message: "Bulk cart updates are not supported"
            });
        }
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return res.status(400).json({
                success: false,
                message: "A cart item is required"
            });
        }

        let cart = await Cart.findOne({ userId: req.user._id });

        if (!cart) {
            cart = new Cart({ userId: req.user._id, items: [] });
        }

        const productId = Number(item.id || item.productId);
        const quantity = Number(item.quantity === undefined ? 1 : item.quantity);

        if (!Number.isSafeInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid product ID is required"
            });
        }

        if (!Number.isSafeInteger(quantity) || quantity < 1) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be a positive integer"
            });
        }

        const product = await Product.findOne({ id: productId });
        if (!product || product.stock < 1) {
            return res.status(404).json({
                success: false,
                message: "Product not found or out of stock"
            });
        }

        const existing = cart.items.find(i => i.productId === productId);
        const updatedQuantity = existing
            ? req.body.overrideQuantity ? quantity : existing.quantity + quantity
            : quantity;

        if (!Number.isSafeInteger(updatedQuantity) || updatedQuantity > product.stock) {
            return res.status(400).json({
                success: false,
                message: "Requested quantity exceeds available stock"
            });
        }

        if (existing) {
            existing.quantity = updatedQuantity;
            existing.name = product.name;
            existing.price = product.price;
            existing.image = product.image;
            existing.category = product.category;
        } else {
            cart.items.push({
                productId,
                name: product.name,
                price: product.price,
                image: product.image,
                category: product.category,
                quantity
            });
        }

        await cart.save();
        const cartData = await buildCartResponse(cart);

        res.json({
            success: true,
            message: "Cart updated successfully",
            cart: cartData
        });
    } catch (error) {
        console.error("Update cart error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update cart"
        });
    }
});

// @route   DELETE /api/cart/:productId
// @desc    Remove an item from cart
router.delete("/:productId", protect, async (req, res) => {
    try {
        const productId = Number(req.params.productId);
        if (!Number.isSafeInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid product ID is required"
            });
        }

        const cart = await Cart.findOne({ userId: req.user._id });

        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        cart.items = cart.items.filter(i => i.productId !== productId);
        await cart.save();
        const cartData = await buildCartResponse(cart);

        res.json({
            success: true,
            message: "Item removed from cart",
            cart: cartData
        });
    } catch (error) {
        console.error("Remove cart item error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to remove item"
        });
    }
});

// @route   DELETE /api/cart
// @desc    Clear entire cart
router.delete("/", protect, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user._id });
        if (cart) {
            cart.items = [];
            await cart.save();
        }

        res.json({
            success: true,
            message: "Cart cleared",
            cart: { items: [], subtotal: 0, count: 0 }
        });
    } catch (error) {
        console.error("Clear cart error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to clear cart"
        });
    }
});

module.exports = router;
