// config/db.js

const mongoose = require("mongoose");

const connectDB = async () => {
    const uri = process.env.MONGO_URI ||
        (process.env.NODE_ENV === "production"
            ? ""
            : "mongodb://127.0.0.1:27017/ladies-fancy-store");
    if (!uri) {
        throw new Error("MONGO_URI is required in production");
    }

    try {
        const conn = await mongoose.connect(uri);

        console.log("✅ MongoDB connection established");
        return conn.connection;
    } catch {
        console.error("❌ MongoDB connection failed");
        throw new Error("MongoDB connection failed");
    }
};

module.exports = connectDB;