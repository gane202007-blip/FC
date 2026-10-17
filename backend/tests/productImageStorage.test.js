const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const jwt = require("jsonwebtoken");
const {
    ensureProductImageDirectory,
    mountProductImageRoutes,
    resolveProductImageDirectory
} = require("../config/productImageStorage");

const temporaryDirectories = [];
const servers = [];

function createTemporaryDirectory() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ladies-fancy-images-"));
    temporaryDirectories.push(directory);
    return directory;
}

after(async () => {
    for (const server of servers) {
        server.closeAllConnections();
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
    }
    temporaryDirectories.forEach(directory => {
        fs.rmSync(directory, { recursive: true, force: true });
    });
});

test("product image storage defaults to images/products and creates configured directories", () => {
    const expectedDefault = path.resolve(__dirname, "../../images/products");
    assert.equal(resolveProductImageDirectory(undefined), expectedDefault);

    const configuredDirectory = path.join(createTemporaryDirectory(), "persistent", "products");
    assert.equal(ensureProductImageDirectory(configuredDirectory), configuredDirectory);
    assert.equal(fs.statSync(configuredDirectory).isDirectory(), true);
});

test("invalid product image directory configuration fails safely", () => {
    assert.throws(
        () => resolveProductImageDirectory("  "),
        /PRODUCT_IMAGE_DIR must be a valid directory path/
    );
    assert.throws(
        () => resolveProductImageDirectory("invalid\0path"),
        /PRODUCT_IMAGE_DIR must be a valid directory path/
    );

    const filePath = path.join(createTemporaryDirectory(), "not-a-directory");
    fs.writeFileSync(filePath, "test");
    assert.throws(
        () => ensureProductImageDirectory(path.join(filePath, "products")),
        /Unable to initialize the product image storage directory/
    );
});

test("admin uploads are saved to the configured product image directory", async () => {
    const configuredDirectory = path.join(createTemporaryDirectory(), "persistent-products");
    const previousDirectory = process.env.PRODUCT_IMAGE_DIR;
    const previousSecret = process.env.JWT_SECRET;
    process.env.PRODUCT_IMAGE_DIR = configuredDirectory;
    process.env.JWT_SECRET = previousSecret || "product-image-storage-test-secret";

    const routePath = require.resolve("../routes/productRoutes");
    const restore = [];
    const replace = (object, property, value) => {
        const original = object[property];
        object[property] = value;
        restore.push(() => { object[property] = original; });
    };
    let createdProduct;

    try {
        delete require.cache[routePath];
        const productRoutes = require(routePath);
        const User = require("../models/User");
        const Product = require("../models/Product");
        replace(User, "findById", id => ({
            select: async () => ({ _id: id, role: "admin" })
        }));
        replace(Product, "findOne", () => ({
            sort: () => ({
                select: () => ({
                    lean: async () => null
                })
            })
        }));
        replace(Product, "create", async product => {
            createdProduct = product;
            return product;
        });

        const app = express();
        app.use(express.json());
        app.use("/api/products", productRoutes);
        mountProductImageRoutes(app, configuredDirectory, createTemporaryDirectory());
        const server = app.listen(0);
        servers.push(server);
        await new Promise(resolve => server.once("listening", resolve));

        const form = new FormData();
        form.set("name", "Persistent image");
        form.set("category", "Earrings");
        form.set("price", "499");
        form.append("imageFiles", new Blob(["image-content"], { type: "image/png" }), "image.png");
        const token = jwt.sign({ id: "admin" }, process.env.JWT_SECRET, { expiresIn: "5m" });
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/products/admin`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form
        });
        assert.equal(response.status, 201);

        const result = await response.json();
        const imagePath = result.product.images[0];
        assert.match(imagePath, /^\/images\/products\/[a-f\d]{32}\.png$/);
        assert.equal(fs.existsSync(path.join(configuredDirectory, path.basename(imagePath))), true);

        const imageResponse = await fetch(
            `http://127.0.0.1:${server.address().port}${imagePath}`
        );
        assert.equal(imageResponse.status, 200);
        assert.equal(await imageResponse.text(), "image-content");
        assert.deepEqual(createdProduct.images, [imagePath]);
    } finally {
        restore.reverse().forEach(restoreMethod => restoreMethod());
        if (previousDirectory === undefined) delete process.env.PRODUCT_IMAGE_DIR;
        else process.env.PRODUCT_IMAGE_DIR = previousDirectory;
        if (previousSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousSecret;
        delete require.cache[routePath];
    }
});

test("configured and existing product image directories serve unchanged /images/products URLs", async () => {
    const configuredDirectory = path.join(createTemporaryDirectory(), "configured");
    const existingImagesDirectory = path.join(createTemporaryDirectory(), "existing");
    fs.mkdirSync(configuredDirectory);
    fs.mkdirSync(path.join(existingImagesDirectory, "products"), { recursive: true });
    fs.writeFileSync(path.join(configuredDirectory, "new.png"), "new image");
    fs.writeFileSync(path.join(existingImagesDirectory, "products", "old.jpg"), "existing image");

    const app = express();
    mountProductImageRoutes(app, configuredDirectory, existingImagesDirectory);
    const server = app.listen(0);
    servers.push(server);
    await new Promise(resolve => server.once("listening", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const configuredImage = await fetch(`${baseUrl}/images/products/new.png`);
    assert.equal(configuredImage.status, 200);
    assert.equal(await configuredImage.text(), "new image");

    const existingImage = await fetch(`${baseUrl}/images/products/old.jpg`);
    assert.equal(existingImage.status, 200);
    assert.equal(await existingImage.text(), "existing image");
});
