// ===============================
// Profile Module
// ===============================

// Get Logged In User
let currentUser = JSON.parse(localStorage.getItem("loggedInUser"));

// Redirect if not logged in
if (!currentUser) {
    alert("Please login first.");
    window.location.href = "../auth/login.html";
}

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

function loadProfile() {

    userName.textContent = currentUser.name || "User";

    fullName.textContent = currentUser.name || "-";

    email.textContent = currentUser.email || "-";

    phone.textContent = currentUser.phone || "Not Added";

    avatar.src =
        `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || "User")}&background=f06292&color=fff&size=200`;

}

loadProfile();

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

profileForm.addEventListener("submit", function (e) {

    e.preventDefault();

    currentUser.name = editName.value.trim();

    currentUser.email = editEmail.value.trim();

    currentUser.phone = editPhone.value.trim();

    localStorage.setItem(
        "loggedInUser",
        JSON.stringify(currentUser)
    );

    // Update users array

    let users = JSON.parse(localStorage.getItem("users")) || [];

    users = users.map(user => {

        if (user.email === currentUser.email) {

            return currentUser;

        }

        return user;

    });

    localStorage.setItem(
        "users",
        JSON.stringify(users)
    );

    loadProfile();

    modal.classList.remove("show");

    alert("Profile updated successfully!");

});

// ===============================
// Logout
// ===============================

logoutBtn.addEventListener("click", () => {

    if (confirm("Are you sure you want to logout?")) {

        localStorage.removeItem("loggedInUser");

        window.location.href = "../auth/login.html";

    }

});