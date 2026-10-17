const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            required: true,
            unique: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        category: {
            type: String,
            required: true,
            trim: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        rating: {
            type: Number,
            default: 4.5,
            min: 0,
            max: 5
        },
        image: {
            type: String,
            required: true
        },
        images: {
            type: [String],
            default: []
        },
        badge: {
            type: String,
            default: ""
        },
        description: {
            type: String,
            default: ""
        },
        stock: {
            type: Number,
            default: 25,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Product", productSchema);
