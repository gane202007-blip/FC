const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
    productId: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    category: {
        type: String,
        default: ""
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    }
});

const cartSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },
        items: [cartItemSchema]
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Cart", cartSchema);
