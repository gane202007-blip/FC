// server.js

const express = require("express");
const connectDB = require("./config/db");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const {
    ensureProductImageDirectory,
    mountProductImageRoutes
} = require("./config/productImageStorage");

dotenv.config();
if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET must be configured before starting the server");
}

const isProduction = process.env.NODE_ENV === "production";
const frontendOrigin = process.env.FRONTEND_ORIGIN;
const isValidOrigin = origin => {
    try {
        const url = new URL(origin);
        return ["http:", "https:"].includes(url.protocol) && url.origin === origin;
    } catch {
        return false;
    }
};

if (isProduction && !isValidOrigin(frontendOrigin)) {
    throw new Error("FRONTEND_ORIGIN must be a valid HTTP(S) origin in production");
}

const app = express();
const productImageDirectory = ensureProductImageDirectory();

// Middleware
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, false);

        const isLocalDevelopmentOrigin = !isProduction && (() => {
            try {
                const url = new URL(origin);
                return ["http:", "https:"].includes(url.protocol) &&
                    ["localhost", "127.0.0.1"].includes(url.hostname) &&
                    url.origin === origin;
            } catch {
                return false;
            }
        })();

        callback(null, origin === frontendOrigin || isLocalDevelopmentOrigin);
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve configured product uploads first, then existing project images.
mountProductImageRoutes(app, productImageDirectory);
app.use("/frontend/images", express.static(path.join(__dirname, "../images")));

// Serve Primary Frontend application
app.use(express.static(path.join(__dirname, "../frontend")));

// API Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/address", require("./routes/addressRoutes"));
app.use("/api/wishlist", require("./routes/wishlistRoutes"));

// API Health Check
app.get("/api/health", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
            return res.status(503).json({
                success: false,
                database: "not_ready",
                timestamp: new Date()
            });
        }
        await mongoose.connection.db.admin().ping();
        res.json({
            success: true,
            database: "ready",
            timestamp: new Date()
        });
    } catch {
        res.status(503).json({
            success: false,
            database: "not_ready",
            timestamp: new Date()
        });
    }
});

// Root Route fallback to frontend index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Handle Invalid API Routes
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API Route Not Found"
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err.message);

    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});

// Start Server
const PORT = process.env.PORT || 5000;

let server;

async function startServer() {
    await connectDB();
    server = app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
    return server;
}

if (require.main === module) {
    startServer().catch(() => {
        console.error("❌ Server startup failed. Check database and server configuration.");
        process.exitCode = 1;
    });
}

module.exports = { app, startServer, get server() { return server; } };