const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "product-admin-test-secret";

const User = require("../models/User");
const Product = require("../models/Product");
const productRoutes = require("../routes/productRoutes");
const authRoutes = require("../routes/authRoutes");

let server;
let baseUrl;

before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/products", productRoutes);
    app.use("/api/auth", authRoutes);
    server = app.listen(0);
    await new Promise(resolve => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) {
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
});

const replace = (object, property, value) => {
    const original = object[property];
    object[property] = value;
    return () => {
        object[property] = original;
    };
};

const tokenFor = role => jwt.sign({ id: role }, process.env.JWT_SECRET, { expiresIn: "5m" });

const request = (url, { role, ...options } = {}) => {
    const headers = { "Content-Type": "application/json", ...options.headers };
    if (role) {
        headers.Authorization = `Bearer ${tokenFor(role)}`;
    }
    return fetch(`${baseUrl}${url}`, { ...options, headers });
};

test("admin product CRUD is authorized, validated, and visible through the public product API", async () => {
    const store = [{
        id: 6,
        name: "Existing product",
        category: "Bangles",
        price: 100,
        image: "https://images.example/product.jpg",
        description: "",
        badge: "",
        stock: 3,
        rating: 4.5,
        save: async function () { return this; }
    }];
    const restore = [];

    restore.push(replace(User, "findById", id => ({
        select: async () => ({ _id: id, role: id })
    })));
    restore.push(replace(Product, "countDocuments", async filter => {
        if (!filter) return store.length;
        if (filter.stock === 0) return store.filter(product => product.stock === 0).length;
        if (filter.stock && filter.stock.$gt === 0) return store.filter(product => product.stock > 0 && product.stock <= filter.stock.$lte).length;
        return store.length;
    }));
    restore.push(replace(Product, "findOne", filter => {
        if (filter && filter.id !== undefined) {
            return Promise.resolve(store.find(product => product.id === filter.id) || null);
        }
        return {
            sort: () => ({
                select: () => ({
                    lean: async () => {
                        const last = store.reduce((highest, product) => Math.max(highest, product.id), 0);
                        return last ? { id: last } : null;
                    }
                })
            })
        };
    }));
    restore.push(replace(Product, "create", async input => {
        const product = { ...input, save: async function () { return this; } };
        store.push(product);
        return product;
    }));
    restore.push(replace(Product, "findOneAndDelete", async filter => {
        const index = store.findIndex(product => product.id === filter.id);
        return index < 0 ? null : store.splice(index, 1)[0];
    }));
    restore.push(replace(Product, "find", filter => ({
        sort: async () => store.filter(product =>
            (!filter.category || product.category === filter.category.$regex.source.replace(/^\^|\$$/g, "")) &&
            (!filter.name || filter.name.$regex.test(product.name))
        )
    })));
    restore.push(replace(Product, "aggregate", async () => {
        const categories = new Map();
        store.forEach(product => categories.set(product.category, (categories.get(product.category) || 0) + 1));
        return Array.from(categories, ([_id, count]) => ({ _id, count }));
    }));

    try {
        const unauthorized = await request("/api/products/admin", {
            method: "POST",
            body: JSON.stringify({ name: "Blocked", category: "Bangles", price: 10, image: "https://images.example/x.jpg" })
        });
        assert.equal(unauthorized.status, 401);

        const nonAdminCreate = await request("/api/products/admin", {
            role: "user",
            method: "POST",
            body: JSON.stringify({ name: "Blocked", category: "Bangles", price: 10, image: "https://images.example/x.jpg" })
        });
        assert.equal(nonAdminCreate.status, 403);

        const forbidden = await request("/api/products/admin/summary", { role: "user" });
        assert.equal(forbidden.status, 403);

        const invalidProduct = await request("/api/products/admin", {
            role: "admin",
            method: "POST",
            body: JSON.stringify({ name: "Invalid", category: "Bangles", price: -1, image: "javascript:alert(1)" })
        });
        assert.equal(invalidProduct.status, 400);

        const invalidImage = await request("/api/products/admin", {
            role: "admin",
            method: "POST",
            body: JSON.stringify({ name: "Invalid image", category: "Bangles", price: 1, image: "javascript:alert(1)" })
        });
        assert.equal(invalidImage.status, 400);

        const createdResponse = await request("/api/products/admin", {
            role: "admin",
            method: "POST",
            body: JSON.stringify({
                name: "Pearl Earrings",
                category: "Earrings",
                price: "799",
                image: "https://images.example/pearl.jpg",
                description: "Freshwater pearls",
                stock: "15"
            })
        });
        assert.equal(createdResponse.status, 201);
        const created = (await createdResponse.json()).product;
        assert.equal(created.id, 7);
        assert.deepEqual(created.images, ["https://images.example/pearl.jpg"]);

        const updateResponse = await request(`/api/products/admin/${created.id}`, {
            role: "admin",
            method: "PUT",
            body: JSON.stringify({ name: "Pearl Drop Earrings", stock: 0 })
        });
        assert.equal(updateResponse.status, 200);

        const publicList = await request("/api/products");
        assert.equal(publicList.status, 200);
        const listed = (await publicList.json()).products.find(product => product.id === created.id);
        assert.equal(listed.name, "Pearl Drop Earrings");
        assert.equal(listed.stock, 0);

        const summaryResponse = await request("/api/products/admin/summary", { role: "admin" });
        assert.equal(summaryResponse.status, 200);
        assert.equal((await summaryResponse.json()).summary.outOfStock, 1);

        const deleteResponse = await request(`/api/products/admin/${created.id}`, {
            role: "admin",
            method: "DELETE"
        });
        assert.equal(deleteResponse.status, 200);
        assert.equal(store.some(product => product.id === created.id), false);
    } finally {
        restore.reverse().forEach(restoreMethod => restoreMethod());
    }
});

test("admin product creation stores uploaded image paths and preserves image URLs", async () => {
    const restoreFindById = replace(User, "findById", id => ({
        select: async () => ({ _id: id, role: id })
    }));
    let createdProduct;
    const restoreFindOne = replace(Product, "findOne", () => ({
        sort: () => ({
            select: () => ({
                lean: async () => ({ id: 12 })
            })
        })
    }));
    const restoreCreate = replace(Product, "create", async product => {
        createdProduct = product;
        return product;
    });
    let savedImagePath;

    try {
        const form = new FormData();
        form.set("name", "Uploaded Earrings");
        form.set("category", "Earrings");
        form.set("price", "499");
        form.set("images", JSON.stringify(["https://images.example/remote.jpg"]));
        form.append("imageFiles", new Blob(["image-content"], { type: "image/png" }), "earrings.png");

        const response = await fetch(`${baseUrl}/api/products/admin`, {
            method: "POST",
            headers: { Authorization: `Bearer ${tokenFor("admin")}` },
            body: form
        });
        assert.equal(response.status, 201);

        const result = await response.json();
        assert.equal(result.product.id, 13);
        assert.equal(result.product.image, "https://images.example/remote.jpg");
        assert.equal(result.product.images[0], result.product.image);
        assert.match(result.product.images[1], /^\/images\/products\/[a-f\d]{32}\.png$/);
        assert.deepEqual(createdProduct.images, result.product.images);
        savedImagePath = path.join(
            __dirname,
            "../../images/products",
            path.basename(result.product.images[1])
        );
        assert.equal(fs.existsSync(savedImagePath), true);
    } finally {
        if (savedImagePath && fs.existsSync(savedImagePath)) {
            fs.unlinkSync(savedImagePath);
        }
        restoreCreate();
        restoreFindOne();
        restoreFindById();
    }
});

test("public registration ignores a requested admin role", async () => {
    let createdUser;
    let createdInput;
    const restoreFindOne = replace(User, "findOne", async () => null);
    const restoreCreate = replace(User, "create", async input => {
        createdInput = input;
        createdUser = { _id: "new-user", role: "user", ...input };
        return createdUser;
    });

    try {
        const response = await request("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({
                name: "Public Account",
                email: "public@example.test",
                password: "valid-password",
                role: "admin"
            })
        });
        assert.equal(response.status, 201);
        assert.equal(createdUser.role, "user");
        assert.equal(Object.hasOwn(createdInput, "role"), false);
        assert.equal((await response.json()).user.role, "user");
    } finally {
        restoreCreate();
        restoreFindOne();
    }
});

test("user login issues a JWT accepted by the authenticated identity route", async () => {
    const user = {
        _id: "existing-user",
        name: "Store User",
        email: "user@example.test",
        phone: "",
        role: "user",
        matchPassword: async password => password === "valid-password"
    };
    const restoreFindOne = replace(User, "findOne", async filter => {
        assert.equal(filter.email, "user@example.test");
        return user;
    });
    const restoreFindById = replace(User, "findById", id => ({
        select: async () => id === user._id ? user : null
    }));

    try {
        const loginResponse = await request("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
                email: "USER@example.test",
                password: "valid-password"
            })
        });
        assert.equal(loginResponse.status, 200);

        const login = await loginResponse.json();
        assert.equal(login.success, true);
        assert.equal(jwt.verify(login.token, process.env.JWT_SECRET).id, user._id);

        const identityResponse = await request("/api/auth/me", {
            headers: { Authorization: `Bearer ${login.token}` }
        });
        assert.equal(identityResponse.status, 200);
        assert.equal((await identityResponse.json()).user.role, "user");

        const invalidLogin = await request("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
                email: user.email,
                password: "incorrect-password"
            })
        });
        assert.equal(invalidLogin.status, 401);
    } finally {
        restoreFindById();
        restoreFindOne();
    }
});

test("login calls port 5000 and rejected credentials do not trigger a session redirect", async () => {
    const location = {
        port: "5500",
        pathname: "/auth/login.html",
        href: ""
    };
    const window = {
        location,
        addEventListener: () => {}
    };
    const localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
    };
    let requestedUrl;
    const fetch = async (url, options) => {
        requestedUrl = url;
        assert.equal(options.method, "POST");
        return {
            status: 401,
            ok: false,
            headers: { get: () => "application/json" },
            json: async () => ({
                success: false,
                message: "Invalid email or password"
            })
        };
    };
    const source = fs.readFileSync(
        path.join(__dirname, "../../frontend/js/api.js"),
        "utf8"
    );
    vm.runInNewContext(source, { window, localStorage, URL, fetch });

    const result = await window.API.request("/auth/login", {
        method: "POST",
        body: { email: "user@example.test", password: "incorrect-password" }
    });

    assert.equal(requestedUrl, "http://localhost:5000/api/auth/login");
    assert.equal(result.message, "Invalid email or password");
    assert.equal(location.href, "");
});

test("API client sends multipart form data without overriding its content type", async () => {
    const values = new Map([["authToken", "admin-token"]]);
    const localStorage = {
        getItem: key => values.get(key) || null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
    const window = {
        location: { port: "5000", pathname: "/admin/products.html" },
        addEventListener: () => {}
    };
    const form = new FormData();
    form.set("name", "Image test");
    let capturedOptions;
    const fetch = async (url, options) => {
        assert.equal(url, "/api/products/admin");
        capturedOptions = options;
        return {
            status: 201,
            ok: true,
            headers: { get: () => "application/json" },
            json: async () => ({ success: true })
        };
    };
    const source = fs.readFileSync(
        path.join(__dirname, "../../frontend/js/api.js"),
        "utf8"
    );
    vm.runInNewContext(source, { window, localStorage, URL, FormData, fetch });

    const result = await window.API.request("/products/admin", {
        method: "POST",
        body: form,
        auth: true
    });

    assert.equal(result.success, true);
    assert.equal(capturedOptions.body, form);
    assert.equal(capturedOptions.headers["Content-Type"], undefined);
    assert.equal(capturedOptions.headers.Authorization, "Bearer admin-token");
});

test("storefront product helpers escape text and reject unsafe image schemes", () => {
    const values = new Map();
    const localStorage = {
        getItem: key => values.get(key) || null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
    const window = {
        location: { port: "5000", pathname: "/admin/products.html" },
        addEventListener: () => {}
    };
    const source = fs.readFileSync(
        path.join(__dirname, "../../frontend/js/api.js"),
        "utf8"
    );
    vm.runInNewContext(source, { window, localStorage, URL });

    assert.equal(window.API.escapeHtml('<img src=x onerror="alert(1)">'),
        "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    assert.equal(window.API.safeProductImage("https://images.example/item.jpg"),
        "https://images.example/item.jpg");
    assert.notEqual(window.API.safeProductImage("javascript:alert(1)"),
        "javascript:alert(1)");
    assert.notEqual(window.API.safeProductImage("/images/../private.jpg"),
        "/images/../private.jpg");

    window.API.setToken("test-token");
    window.API.setUser({ id: "user-1" });
    assert.equal(window.API.isLoggedIn(), true);
    window.API.clearAuth();
    assert.equal(window.API.isLoggedIn(), false);
    assert.equal(values.has("authToken"), false);
    assert.equal(values.has("loggedInUser"), false);
});
