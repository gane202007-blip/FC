/* ===========================================
   Ladies Fancy Store
   Authentication System (Frontend)
   =========================================== */

const STORAGE_KEY = "users";
const CURRENT_USER = "loggedInUser";

/* ===========================
   Utility Functions
=========================== */

function getUsers() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function saveUsers(users) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

/* ===========================
   Register User
=========================== */

function registerUser(name, mobile, email, password) {

    const users = getUsers();

    const existingUser = users.find(user =>
        user.email.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
        return {
            success: false,
            message: "Email already registered."
        };
    }

    const newUser = {
        id: Date.now(),
        name,
        phone: mobile,
        email,
        password,
        createdAt: new Date().toISOString(),
        orders: [],
        addresses: [],
        wishlist: []
    };
    users.push(newUser);
    saveUsers(users);

    return {
        success: true,
        message: "Registration successful."
    };
}

/* ===========================
   Login User
=========================== */

function loginUser(email, password, remember = false) {

    const users = getUsers();

    const user = users.find(u =>
        u.email.toLowerCase() === email.toLowerCase() &&
        u.password === password
    );

    if (!user) {
        return {
            success: false,
            message: "Invalid email or password."
        };
    }

    localStorage.setItem(CURRENT_USER, JSON.stringify(user));

    if (remember) {
        localStorage.setItem("rememberEmail", email);
    } else {
        localStorage.removeItem("rememberEmail");
    }

    return {
        success: true,
        message: "Login successful.",
        user
    };
}

/* ===========================
   Logout
=========================== */

function logoutUser() {

    localStorage.removeItem(CURRENT_USER);

    alert("Logged out successfully.");

    window.location.href = "../auth/login.html";
}

/* ===========================
   Current User
=========================== */

function getCurrentUser() {
    return JSON.parse(localStorage.getItem(CURRENT_USER));
}

/* ===========================
   Login Status
=========================== */

function isLoggedIn() {
    return getCurrentUser() !== null;
}

/* ===========================
   Protect Pages
=========================== */

function requireLogin() {

    if (!isLoggedIn()) {

        alert("Please login first.");

        window.location.href = "../auth/login.html";
    }

}

/* ===========================
   Remember Me
=========================== */

document.addEventListener("DOMContentLoaded", () => {

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const remember = document.getElementById("rememberMe").checked;

    if (emailInput && rememberedEmail) {

        emailInput.value = rememberedEmail;

        if (rememberCheck) {
            rememberCheck.checked = true;
        }

    }

});