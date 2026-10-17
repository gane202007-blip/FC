const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        productId: {
            type: Number,
            required: true
        },
        product: {
            name: { type: String, required: true },
            price: { type: Number, required: true },
            image: { type: String, required: true },
            category: { type: String, default: "" },
            rating: { type: Number, default: 4.5 }
        }
    },
    {
        timestamps: true
    }
);

wishlistSchema.index({ userId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model("Wishlist", wishlistSchema);
