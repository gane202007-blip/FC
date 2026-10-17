const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
    productId: { type: Number, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String, required: true },
    category: { type: String, default: "" }
});

const shippingAddressSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true }
});

const orderSchema = new mongoose.Schema(
    {
        orderId: {
            type: String,
            required: true,
            unique: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        checkoutRequestId: {
            type: String
        },
        cartUpdatedAt: {
            type: Date
        },
        items: [orderItemSchema],
        shippingAddress: shippingAddressSchema,
        paymentMethod: {
            type: String,
            enum: ["COD", "UPI", "Card"],
            default: "COD"
        },
        paymentStatus: {
            type: String,
            enum: ["Pending", "Completed", "Failed"],
            default: "Pending"
        },
        subtotal: {
            type: Number,
            required: true
        },
        shipping: {
            type: Number,
            default: 0
        },
        discount: {
            type: Number,
            default: 0
        },
        total: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ["Processing", "Confirmed", "Shipped", "Delivered", "Cancelled"],
            default: "Processing"
        }
    },
    {
        timestamps: true
    }
);

orderSchema.index(
    { userId: 1, checkoutRequestId: 1 },
    {
        unique: true,
        partialFilterExpression: { checkoutRequestId: { $type: "string" } }
    }
);

module.exports = mongoose.model("Order", orderSchema);
