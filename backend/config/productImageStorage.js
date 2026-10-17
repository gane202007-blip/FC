const express = require("express");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "../..");
const defaultImageDirectory = path.join(projectRoot, "images", "products");
const legacyImageDirectory = path.join(projectRoot, "images");

function resolveProductImageDirectory(configuredDirectory = process.env.PRODUCT_IMAGE_DIR) {
    if (configuredDirectory === undefined) return defaultImageDirectory;
    if (typeof configuredDirectory !== "string" ||
        !configuredDirectory.trim() ||
        configuredDirectory.includes("\0")) {
        throw new Error("PRODUCT_IMAGE_DIR must be a valid directory path");
    }

    return path.resolve(projectRoot, configuredDirectory.trim());
}

function ensureProductImageDirectory(configuredDirectory) {
    const directory = resolveProductImageDirectory(configuredDirectory);
    try {
        fs.mkdirSync(directory, { recursive: true });
        if (!fs.statSync(directory).isDirectory()) {
            throw new Error();
        }
    } catch {
        throw new Error("Unable to initialize the product image storage directory");
    }
    return directory;
}

function mountProductImageRoutes(app, productImageDirectory, existingImagesDirectory = legacyImageDirectory) {
    app.use("/images/products", express.static(productImageDirectory));
    app.use("/images", express.static(existingImagesDirectory));
}

module.exports = {
    ensureProductImageDirectory,
    mountProductImageRoutes,
    resolveProductImageDirectory
};
