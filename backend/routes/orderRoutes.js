const express = require("express");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

const clearOrderedCart = async (userId, order) => {
    if (!order.cartUpdatedAt) {
        return;
    }

    await Cart.updateOne(
        { userId, updatedAt: order.cartUpdatedAt },
        { $set: { items: [] } }
    );
};

const restoreStock = async reservations => {
    for (const reservation of reservations) {
        await Product.updateOne(
            { id: reservation.productId },
            { $inc: { stock: reservation.quantity } }
        );
    }
};

// Helper to generate a professional order ID
const generateOrderId = () => {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    return `#LF${randomDigits}`;
};

// @route   GET /api/orders
// @desc    Get all orders for the logged-in user
router.get("/", protect, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json({
            success: true,
            count: orders.length,
            orders
        });
    } catch (error) {
        console.error("Get orders error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch orders"
        });
    }
});

// @route   GET /api/orders/:id
// @desc    Get order details by orderId or _id
router.get("/:id", protect, async (req, res) => {
    try {
        const param = req.params.id;
        const query = { userId: req.user._id };

        if (param.startsWith("#LF")) {
            if (!/^#LF\d{6}$/.test(param)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid order ID"
                });
            }
            query.orderId = param;
        } else {
            if (!/^[a-f\d]{24}$/i.test(param)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid order ID"
                });
            }
            query._id = param;
        }

        const order = await Order.findOne(query);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.json({
            success: true,
            order
        });
    } catch (error) {
        console.error("Get order details error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch order details"
        });
    }
});

// @route   POST /api/orders
// @desc    Create a new order with server-side validation
router.post("/", protect, async (req, res) => {
    let stockReservations = [];
    let orderCreated = false;

    try {
        const {
            shippingAddress,
            paymentMethod = "COD",
            couponCode,
            checkoutRequestId
        } = req.body;

        if (typeof checkoutRequestId !== "string" ||
            !/^[A-Za-z0-9_-]{16,100}$/.test(checkoutRequestId)) {
            return res.status(400).json({
                success: false,
                message: "A valid checkout request ID is required"
            });
        }

        const existingOrder = await Order.findOne({
            userId: req.user._id,
            checkoutRequestId
        });
        if (existingOrder) {
            await clearOrderedCart(req.user._id, existingOrder);
            return res.status(200).json({
                success: true,
                message: "Order already placed",
                order: existingOrder
            });
        }

        const cart = await Cart.findOne({ userId: req.user._id });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot place order with an empty cart"
            });
        }

        if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.pincode) {
            return res.status(400).json({
                success: false,
                message: "Please provide a complete shipping address"
            });
        }

        if (paymentMethod !== "COD") {
            return res.status(400).json({
                success: false,
                message: "Only Cash on Delivery is currently supported"
            });
        }

        let subtotal = 0;
        const validatedItems = [];

        for (const cartItem of cart.items) {
            const pId = Number(cartItem.productId);
            const qty = Number(cartItem.quantity);

            if (!Number.isSafeInteger(pId) || pId <= 0 ||
                !Number.isSafeInteger(qty) || qty < 1) {
                return res.status(400).json({
                    success: false,
                    message: "The cart contains an invalid item or quantity"
                });
            }

            const product = await Product.findOne({ id: pId });
            if (!product || product.stock < qty) {
                return res.status(400).json({
                    success: false,
                    message: "A cart product is unavailable or has insufficient stock"
                });
            }

            const itemSubtotal = product.price * qty;
            subtotal += itemSubtotal;

            validatedItems.push({
                productId: pId,
                name: product.name,
                price: product.price,
                quantity: qty,
                image: product.image,
                category: product.category
            });
        }

        const shipping = 0;

        let discount = 0;
        if (typeof couponCode === "string" && couponCode.toUpperCase() === "WELCOME10") {
            discount = Math.round(subtotal * 0.1);
        }

        const total = Math.max(0, subtotal + shipping - discount);

        for (const item of validatedItems) {
            const reservation = await Product.updateOne(
                {
                    id: item.productId,
                    stock: { $gte: item.quantity }
                },
                {
                    $inc: { stock: -item.quantity }
                }
            );

            if (reservation.modifiedCount !== 1) {
                const reservationsToRestore = stockReservations;
                stockReservations = [];
                await restoreStock(reservationsToRestore);
                return res.status(400).json({
                    success: false,
                    message: "A cart product is unavailable or has insufficient stock"
                });
            }

            stockReservations.push({
                productId: item.productId,
                quantity: item.quantity
            });
        }

        let orderId = generateOrderId();
        // Ensure uniqueness
        while (await Order.findOne({ orderId })) {
            orderId = generateOrderId();
        }

        let order;
        try {
            order = await Order.create({
                orderId,
                userId: req.user._id,
                checkoutRequestId,
                cartUpdatedAt: cart.updatedAt,
                items: validatedItems,
                shippingAddress,
                paymentMethod,
                paymentStatus: "Pending",
                subtotal,
                shipping,
                discount,
                total,
                status: "Processing"
            });
            orderCreated = true;
        } catch (error) {
            if (error.code === 11000 && checkoutRequestId) {
                const existingOrder = await Order.findOne({
                    userId: req.user._id,
                    checkoutRequestId
                });
                if (existingOrder) {
                    const reservationsToRestore = stockReservations;
                    stockReservations = [];
                    await restoreStock(reservationsToRestore);
                    await clearOrderedCart(req.user._id, existingOrder);
                    return res.status(200).json({
                        success: true,
                        message: "Order already placed",
                        order: existingOrder
                    });
                }
            }
            throw error;
        }

        await clearOrderedCart(req.user._id, order);

        res.status(201).json({
            success: true,
            message: "Order placed successfully",
            order
        });
    } catch (error) {
        if (!orderCreated && stockReservations.length > 0) {
            const reservationsToRestore = stockReservations;
            stockReservations = [];
            try {
                await restoreStock(reservationsToRestore);
            } catch (restoreError) {
                console.error("Stock reservation rollback failed:", restoreError);
            }
        }

        console.error("Create order error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to create order"
        });
    }
});

// @route   GET /api/orders/admin/summary
// @desc    Get order analytics summary for admin dashboard
router.get("/admin/summary", protect, admin, async (req, res) => {
    try {
        const [totalOrders, pendingOrders, shippedOrders, revenue] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ status: "Processing" }),
            Order.countDocuments({ status: "Shipped" }),
            Order.aggregate([
                { $group: { _id: null, total: { $sum: "$total" } } }
            ])
        ]);

        res.json({
            success: true,
            summary: {
                totalOrders,
                pendingOrders,
                shippedOrders,
                revenue: revenue[0] ? revenue[0].total : 0
            }
        });
    } catch (error) {
        console.error("Admin order summary error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch order summary"
        });
    }
});

// @route   GET /api/orders/admin
// @desc    List all orders for the admin dashboard
router.get("/admin", protect, admin, async (req, res) => {
    try {
        const orders = await Order.find({}).sort({ createdAt: -1 });
        res.json({
            success: true,
            count: orders.length,
            orders
        });
    } catch (error) {
        console.error("Admin list orders error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch orders"
        });
    }
});

// @route   PUT /api/orders/admin/:id/status
// @desc    Update the order status from the admin dashboard
router.put("/admin/:id/status", protect, admin, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ["Processing", "Confirmed", "Shipped", "Delivered", "Cancelled"];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "A valid order status is required"
            });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        order.status = status;
        await order.save();

        res.json({
            success: true,
            message: "Order status updated successfully",
            order
        });
    } catch (error) {
        console.error("Admin update order status error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update order status"
        });
    }
});

module.exports = router;
