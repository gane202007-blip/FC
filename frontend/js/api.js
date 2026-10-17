/* ===========================================
   Ladies Fancy Store — Unified API & Auth Client
   =========================================== */

(function () {
    const hostname = window.location.hostname || "localhost";
    const isLocalDevelopment =
        ["localhost", "127.0.0.1"].includes(hostname) &&
        window.location.port !== "5000";
    const API_BASE = isLocalDevelopment
        ? `http://${hostname}:5000/api`
        : "/api";

    const TOKEN_KEY = "authToken";
    const USER_KEY = "loggedInUser";

    function getToken() {
        return localStorage.getItem(TOKEN_KEY) || "";
    }

    function setToken(token) {
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
        } else {
            localStorage.removeItem(TOKEN_KEY);
        }
    }

    function getUser() {
        try {
            return JSON.parse(localStorage.getItem(USER_KEY)) || null;
        } catch {
            return null;
        }
    }

    function setUser(user) {
        if (user) {
            localStorage.setItem(USER_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(USER_KEY);
        }
    }

    function clearAuth() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    function isLoggedIn() {
        return Boolean(getToken() && getUser());
    }

    async function request(endpoint, options = {}) {
        const { method = "GET", body = null, auth = false } = options;

        const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
        const headers = {};
        if (!isFormData) {
            headers["Content-Type"] = "application/json";
        }

        const token = getToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        } else if (auth) {
            return {
                success: false,
                message: "Authentication required",
                unauthorized: true
            };
        }

        const fetchOptions = {
            method,
            headers
        };

        if (body && method !== "GET") {
            fetchOptions.body = isFormData ? body : JSON.stringify(body);
        }

        try {
            const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
            const res = await fetch(url, fetchOptions);

            let data;
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                data = await res.json();
            } else {
                data = { success: res.ok, message: await res.text() };
            }

            if (res.status === 401 && auth) {
                clearAuth();
                data.unauthorized = true;
                const loginPath = window.location.pathname.includes("/profile/") ||
                    window.location.pathname.includes("/admin/") ||
                    window.location.pathname.includes("/checkout/")
                    ? "../auth/login.html"
                    : "auth/login.html";
                window.location.href = loginPath;
            }

            return data;
        } catch (error) {
            console.warn("API request failed, checking offline/fallback:", error.message);
            return {
                success: false,
                message: "Network or server connection failed",
                error: error.message
            };
        }
    }

    // High quality fallback SVG image for broken images
    const FALLBACK_IMAGE = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22400%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20400%20400%22%3E%3Crect%20fill%3D%22%23fff0f5%22%20width%3D%22400%22%20height%3D%22400%22%2F%3E%3Ccircle%20cx%3D%22200%22%20cy%3D%22180%22%20r%3D%2260%22%20fill%3D%22%23ffd1dc%22%2F%3E%3Ctext%20fill%3D%22%23e91e63%22%20font-family%3D%22system-ui%2C%20sans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22bold%22%20x%3D%2250%25%22%20y%3D%2247%25%22%20text-anchor%3D%22middle%22%3E%E2%9C%A8%20Ladies%20Fancy%3C%2Ftext%3E%3Ctext%20fill%3D%22%23888%22%20font-family%3D%22system-ui%2C%20sans-serif%22%20font-size%3D%2213%22%20x%3D%2250%25%22%20y%3D%2256%25%22%20text-anchor%3D%22middle%22%3EElegance%20Redefined%3C%2Ftext%3E%3C%2Fsvg%3E';

    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[character];
        });
    }

    function safeProductImage(value) {
        const image = String(value || "");
        if (image.startsWith("/images/") &&
            image.slice("/images/".length).split("/").every(part => part !== "..") &&
            /^[a-z0-9_./-]+$/i.test(image.slice("/images/".length))) {
            return image;
        }
        try {
            const url = new URL(image);
            if (url.protocol === "https:" && !url.username && !url.password) {
                return image;
            }
        } catch {
            // Invalid product image URLs fall back to the store placeholder.
        }
        return FALLBACK_IMAGE;
    }

    function handleImgError(img) {
        if (!img || img.dataset.hasFallback) return;
        img.dataset.hasFallback = "true";
        img.src = FALLBACK_IMAGE;
    }

    // Attach global image error listener
    window.addEventListener(
        "error",
        function (e) {
            if (e.target && e.target.tagName === "IMG") {
                handleImgError(e.target);
            }
        },
        true
    );

    window.API = {
        BASE_URL: API_BASE,
        getToken,
        setToken,
        getUser,
        setUser,
        clearAuth,
        isLoggedIn,
        request,
        FALLBACK_IMAGE,
        escapeHtml,
        safeProductImage,
        handleImgError
    };
})();
