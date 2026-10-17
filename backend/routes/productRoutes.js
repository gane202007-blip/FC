const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const Product = require("../models/Product");
const { protect, admin } = require("../middleware/authMiddleware");
const { ensureProductImageDirectory } = require("../config/productImageStorage");

const router = express.Router();
const productImageDirectory = ensureProductImageDirectory();
const imageExtensions = {
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
};
const imageUpload = multer({
    storage: multer.diskStorage({
        destination: productImageDirectory,
        filename: (req, file, callback) => {
            callback(null, `${crypto.randomBytes(16).toString("hex")}${imageExtensions[file.mimetype]}`);
        }
    }),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 10,
        fields: 10,
        fieldSize: 24 * 1024
    },
    fileFilter: (req, file, callback) => {
        if (!imageExtensions[file.mimetype]) {
            const error = new Error("Upload JPEG, PNG, GIF, WebP, or AVIF image files.");
            error.status = 400;
            return callback(error);
        }
        callback(null, true);
    }
});

function parseProductUpload(req, res, next) {
    if (!req.is("multipart/form-data")) return next();

    imageUpload.array("imageFiles", 10)(req, res, error => {
        if (error) {
            return res.status(error.status || 400).json({
                success: false,
                message: error.message || "Unable to upload product images"
            });
        }
        next();
    });
}

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const editableFields = ["name", "category", "price", "image", "images", "description", "stock", "badge", "rating"];

const validateProductInput = (body, partial = false, uploadedImages = []) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "Product details must be provided as an object" };
    }

    const unknownFields = Object.keys(body).filter(field => !editableFields.includes(field));
    if (unknownFields.length) {
        return { error: `Unsupported product field: ${unknownFields[0]}` };
    }

    const normalized = {};
    const stringFields = {
        name: { required: !partial, nonEmpty: true, maxLength: 120 },
        category: { required: !partial, nonEmpty: true, maxLength: 60 },
        description: { required: false, maxLength: 2000 },
        badge: { required: false, maxLength: 40 }
    };

    for (const [field, options] of Object.entries(stringFields)) {
        if (body[field] === undefined) {
            if (options.required) return { error: `${field} is required` };
            continue;
        }
        if (typeof body[field] !== "string") {
            return { error: `${field} must be text` };
        }
        const value = body[field].trim();
        if (options.nonEmpty && !value) return { error: `${field} cannot be empty` };
        if (value.length > options.maxLength) {
            return { error: `${field} must be ${options.maxLength} characters or fewer` };
        }
        normalized[field] = value;
    }

    let imageList;
    if (body.images !== undefined) {
        try {
            imageList = typeof body.images === "string" ? JSON.parse(body.images) : body.images;
        } catch {
            return { error: "Images must be provided as a valid list" };
        }
        if (!Array.isArray(imageList)) {
            return { error: "Images must be provided as a list" };
        }
    } else if (body.image !== undefined) {
        imageList = [body.image];
    }

    if (imageList !== undefined) {
        if (imageList.length + uploadedImages.length > 10) {
            return { error: "A product can have up to 10 images" };
        }
        for (const image of imageList) {
            if (typeof image !== "string" || !image.trim() || image.length > 2048 ||
                !isAllowedImage(image.trim())) {
                return { error: "Each image must be an HTTPS URL or a path under /images/" };
            }
        }
        imageList = [...imageList.map(image => image.trim()), ...uploadedImages];
    } else if (uploadedImages.length) {
        imageList = uploadedImages;
    }

    if (imageList !== undefined) {
        if (!imageList.length) return { error: "Add at least one product image" };
        normalized.images = imageList;
        normalized.image = imageList[0];
    } else if (!partial) {
        return { error: "Add at least one product image" };
    }

    for (const [field, options] of Object.entries({
        price: { required: !partial, min: 0, max: 100000000 },
        stock: { required: false, min: 0, max: 100000000, integer: true },
        rating: { required: false, min: 0, max: 5 }
    })) {
        if (body[field] === undefined) {
            if (options.required) return { error: `${field} is required` };
            continue;
        }
        const raw = body[field];
        if ((typeof raw !== "number" && typeof raw !== "string") ||
            (typeof raw === "string" && !raw.trim())) {
            return { error: `${field} must be a valid number` };
        }
        const value = Number(raw);
        if (!Number.isFinite(value) || value < options.min || value > options.max ||
            (options.integer && !Number.isInteger(value))) {
            return { error: `${field} is outside the allowed range` };
        }
        normalized[field] = value;
    }

    if (!partial) {
        if (normalized.stock === undefined) normalized.stock = 25;
        if (normalized.rating === undefined) normalized.rating = 4.5;
        if (normalized.description === undefined) normalized.description = "";
        if (normalized.badge === undefined) normalized.badge = "";
    }
    if (partial && Object.keys(normalized).length === 0) {
        return { error: "Provide at least one product field to update" };
    }

    return { value: normalized };
};

function isAllowedImage(value) {
    if (value.startsWith("/images/")) {
        return !value.includes("\\") &&
            value.split("/").every(part => part !== "..");
    }

    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
    } catch {
        return false;
    }
}

const parseProductId = value => {
    if (!/^[1-9]\d*$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
};

async function removeUploadedImages(files = []) {
    await Promise.all(files.map(async file => {
        try {
            await fs.promises.unlink(file.path);
        } catch (error) {
            if (error.code !== "ENOENT") {
                console.error("Unable to remove an unreferenced product image:", error.message);
            }
        }
    }));
}

const uploadedImagePaths = req => (req.files || []).map(file =>
    `/images/products/${path.basename(file.filename)}`
);

// Helper to auto-seed if products collection is empty
const ensureProductsSeeded = async () => {
    try {
        const count = await Product.countDocuments();
        if (count === 0) {
            const dataPath = path.join(__dirname, "../../frontend/data/products.json");
            if (fs.existsSync(dataPath)) {
                const rawData = fs.readFileSync(dataPath, "utf8");
                const products = JSON.parse(rawData);
                await Product.insertMany(products);
                console.log(`✅ Auto-seeded ${products.length} products into MongoDB`);
            }
        }
    } catch (err) {
        console.error("Product seed check error:", err.message);
    }
};

// @route   GET /api/products
// @desc    Get all products with optional filtering
router.get("/", async (req, res) => {
    try {
        await ensureProductsSeeded();
        const { category, search } = req.query;
        const query = {};

        if ((category !== undefined && typeof category !== "string") ||
            (search !== undefined && typeof search !== "string")) {
            return res.status(400).json({
                success: false,
                message: "Invalid product filter"
            });
        }

        if (category && category !== "All Products") {
            query.category = { $regex: new RegExp(`^${escapeRegex(category)}$`, "i") };
        }

        if (search) {
            query.name = { $regex: escapeRegex(search), $options: "i" };
        }

        const products = await Product.find(query).sort({ id: 1 });
        res.json({
            success: true,
            count: products.length,
            products
        });
    } catch (error) {
        console.error("Get products error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch products"
        });
    }
});

// @route   GET /api/products/:id
// @desc    Get single product by numeric ID or ObjectId
router.get("/:id", async (req, res) => {
    try {
        await ensureProductsSeeded();
        const param = req.params.id;

        let product;
        if (/^\d+$/.test(param)) {
            const numericId = Number(param);
            if (!Number.isSafeInteger(numericId) || numericId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product ID"
                });
            }
            product = await Product.findOne({ id: numericId });
        } else if (/^[a-f\d]{24}$/i.test(param)) {
            product = await Product.findById(param);
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json({
            success: true,
            product
        });
    } catch (error) {
        console.error("Get single product error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch product"
        });
    }
});

// @route   GET /api/products/admin/summary
// @desc    Get product inventory overview for admin dashboard
router.get("/admin/summary", protect, admin, async (req, res) => {
    try {
        const [totalProducts, lowStock, outOfStock, categories] = await Promise.all([
            Product.countDocuments(),
            Product.countDocuments({ stock: { $gt: 0, $lte: 10 } }),
            Product.countDocuments({ stock: 0 }),
            Product.aggregate([
                { $group: { _id: "$category", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
        ]);

        res.json({
            success: true,
            summary: {
                totalProducts,
                lowStock,
                outOfStock,
                categories: categories.map(item => ({
                    category: item._id,
                    count: item.count
                }))
            }
        });
    } catch (error) {
        console.error("Admin product summary error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch product summary"
        });
    }
});

// @route   POST /api/products/admin
// @desc    Create a new product (admin only)
router.post("/admin", protect, admin, parseProductUpload, async (req, res) => {
    try {
        const validation = validateProductInput(req.body, false, uploadedImagePaths(req));
        if (validation.error) {
            await removeUploadedImages(req.files);
            return res.status(400).json({
                success: false,
                message: validation.error
            });
        }

        const lastProduct = await Product.findOne().sort({ id: -1 }).select("id").lean();
        const product = await Product.create({
            ...validation.value,
            id: (lastProduct?.id || 0) + 1
        });

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            product
        });
    } catch (error) {
        await removeUploadedImages(req.files);
        console.error("Create product error:", error);
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A product with that ID already exists. Please try again."
            });
        }
        const isValidationError = error.name === "ValidationError" || error.name === "CastError";
        res.status(isValidationError ? 400 : 500).json({
            success: false,
            message: isValidationError ? error.message : "Failed to create product"
        });
    }
});

// @route   PUT /api/products/admin/:id
// @desc    Update a product (admin only)
router.put("/admin/:id", protect, admin, parseProductUpload, async (req, res) => {
    try {
        const id = parseProductId(req.params.id);
        if (id === null) {
            await removeUploadedImages(req.files);
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const validation = validateProductInput(req.body, true, uploadedImagePaths(req));
        if (validation.error) {
            await removeUploadedImages(req.files);
            return res.status(400).json({
                success: false,
                message: validation.error
            });
        }

        const product = await Product.findOne({ id });
        if (!product) {
            await removeUploadedImages(req.files);
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        Object.assign(product, validation.value);

        await product.save();
        res.json({
            success: true,
            message: "Product updated successfully",
            product
        });
    } catch (error) {
        await removeUploadedImages(req.files);
        console.error("Update product error:", error);
        if (error.name === "ValidationError") {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({
            success: false,
            message: "Failed to update product"
        });
    }
});

// @route   DELETE /api/products/admin/:id
// @desc    Delete a product (admin only)
router.delete("/admin/:id", protect, admin, async (req, res) => {
    try {
        const id = parseProductId(req.params.id);
        if (id === null) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const product = await Product.findOneAndDelete({ id });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json({
            success: true,
            message: "Product deleted successfully"
        });
    } catch (error) {
        console.error("Delete product error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete product"
        });
    }
});

module.exports = router;
