// ===============================
// Profile Module
// ===============================

// Get Logged In User
// ===============================
// Profile Module
// ===============================

let currentUser = null;

// ===============================
// Elements
// ===============================

const userName = document.getElementById("userName");
const fullName = document.getElementById("fullName");
const email = document.getElementById("email");
const phone = document.getElementById("phone");

const avatar = document.querySelector(".profile-image img");

const editBtn = document.getElementById("editProfileBtn");
const logoutBtn = document.getElementById("logoutBtn");

const modal = document.getElementById("editModal");
const closeBtn = document.querySelector(".close-btn");

const profileForm = document.getElementById("profileForm");

const editName = document.getElementById("editName");
const editEmail = document.getElementById("editEmail");
const editPhone = document.getElementById("editPhone");

// ===============================
// Load User
// ===============================

async function loadProfile() {
    const token = localStorage.getItem("authToken");
    if (!token) {
        localStorage.removeItem("loggedInUser");
        window.location.href = "../auth/login.html";
        return;
    }

    try {
        const response = await window.API.request("/auth/me", {
            auth: true,
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (response.unauthorized) {
            return;
        }

        if (!response.success) {
            throw new Error(response.message);
        }

        currentUser = response.user;

        localStorage.setItem(
            "loggedInUser",
            JSON.stringify(currentUser)
        );

        userName.textContent = currentUser.name || "User";
        fullName.textContent = currentUser.name || "-";
        email.textContent = currentUser.email || "-";
        phone.textContent = currentUser.phone || "Not Added";

        avatar.src =
            `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || "User")}&background=d88b8f&color=fff&size=200`;

    } catch (error) {
        console.error("Failed to load profile:", error);
        alert("Unable to load your profile. Please try again.");
    }
}

loadProfile();

logoutBtn.addEventListener("click", () => {
    if (!window.confirm("Are you sure you want to log out?")) {
        return;
    }

    localStorage.removeItem("authToken");
    localStorage.removeItem("loggedInUser");
    window.location.href = "../auth/login.html";
});

// ===============================
// Open Modal
// ===============================

editBtn.addEventListener("click", () => {

    editName.value = currentUser.name || "";

    editEmail.value = currentUser.email || "";

    editPhone.value = currentUser.phone || "";

    modal.classList.add("show");

});

// ===============================
// Close Modal
// ===============================

closeBtn.addEventListener("click", () => {

    modal.classList.remove("show");

});

window.addEventListener("click", (e) => {

    if (e.target === modal) {

        modal.classList.remove("show");

    }

});
// ===============================
// Save Profile
// ===============================

profileForm.addEventListener("submit", async function (e) {

    e.preventDefault();

    try {
        const response = await window.API.request("/users/profile", {
            method: "PUT",
            auth: true,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: {
                name: editName.value.trim(),
                phone: editPhone.value.trim()
            }
        });

        if (!response.success) {
            alert(response.message || "Profile update failed.");
            return;
        }

        currentUser = response.user;

        localStorage.setItem(
            "loggedInUser",
            JSON.stringify(currentUser)
        );

        loadProfile();

        modal.classList.remove("show");

        alert("Profile updated successfully!");

    } catch (error) {
        console.error("Profile update error:", error);
        alert("Unable to update profile. Please try again.");
    }
});
