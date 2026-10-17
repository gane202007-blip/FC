const ADDRESS_API_URL = "/address";

const addressesContainer = document.getElementById("addressesContainer");
const addressMessage = document.getElementById("addressMessage");
const addressModal = document.getElementById("addressModal");
const addressForm = document.getElementById("addressForm");
const addressModalTitle = document.getElementById("addressModalTitle");
const addressSubmitButton = addressForm.querySelector('[type="submit"]');

let addresses = [];
let editingAddressId = null;

function redirectToLogin() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("loggedInUser");
    window.location.href = "../auth/login.html";
}

function setMessage(message, type = "") {
    addressMessage.textContent = message;
    addressMessage.className = `address-message${type ? ` ${type}` : ""}`;
}

async function addressRequest(url, options = {}) {
    const token = localStorage.getItem("authToken");

    if (!token) {
        redirectToLogin();
        throw new Error("Authentication required");
    }

    const response = await window.API.request(url, {
        ...options,
        auth: true,
        headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`,
            ...(options.body ? { "Content-Type": "application/json" } : {})
        }
    });

    if (response.unauthorized) {
        redirectToLogin();
        throw new Error("Authentication required");
    }

    const data = response;
    if (data.success === false) {
        const error = new Error(data.message || "Address request failed");
        throw error;
    }

    return data;
}

function createTextElement(tagName, text, className = "") {
    const element = document.createElement(tagName);
    element.textContent = text;
    if (className) {
        element.className = className;
    }
    return element;
}

function createActionButton(action, label, iconClass, className, addressId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.dataset.action = action;
    button.dataset.addressId = addressId;

    const icon = document.createElement("i");
    icon.className = iconClass;
    button.append(icon, document.createTextNode(` ${label}`));
    return button;
}

function renderAddresses() {
    addressesContainer.replaceChildren();

    if (addresses.length === 0) {
        addressesContainer.append(
            createTextElement("p", "You have no saved addresses yet.", "address-empty")
        );
        return;
    }

    addresses.forEach((address) => {
        const card = document.createElement("section");
        card.className = "address-card";

        const top = document.createElement("div");
        top.className = "address-top";
        top.append(createTextElement("h3", address.type || "Address"));

        if (address.isDefault) {
            top.append(createTextElement("span", "Default", "default-badge"));
        }

        const name = document.createElement("p");
        const strongName = createTextElement("strong", address.fullName || "");
        name.append(strongName);

        const phone = createTextElement("p", address.phone || "");
        const locality = [address.city, address.state].filter(Boolean).join(", ");
        const addressLine = [address.street, locality, address.pincode]
            .filter(Boolean)
            .join(", ");
        const details = createTextElement("p", addressLine);

        const actions = document.createElement("div");
        actions.className = "address-actions";
        actions.append(
            createActionButton("edit", "Edit", "fas fa-pen", "edit-btn", address._id),
            createActionButton("delete", "Delete", "fas fa-trash", "delete-btn", address._id)
        );

        if (!address.isDefault) {
            actions.append(
                createActionButton(
                    "default",
                    "Set as default",
                    "fas fa-star",
                    "edit-btn",
                    address._id
                )
            );
        }

        card.append(top, name, phone, details, actions);
        addressesContainer.append(card);
    });
}

async function loadAddresses(successMessage = "") {
    setMessage("Loading saved addresses...");

    try {
        const data = await addressRequest(ADDRESS_API_URL);
        if (!Array.isArray(data.addresses)) {
            throw new Error("Unexpected address response");
        }

        addresses = data.addresses;
        renderAddresses();
        setMessage(successMessage, successMessage ? "success" : "");
        return true;
    } catch (error) {
        console.error("Could not load saved addresses:", error);
        setMessage("Unable to load addresses. Please try again.", "error");
        return false;
    }
}

function openAddressForm(address = null) {
    addressForm.reset();
    editingAddressId = address ? address._id : null;
    addressModalTitle.textContent = address ? "Edit Address" : "Add New Address";
    addressSubmitButton.textContent = address ? "Save Changes" : "Save Address";

    if (address) {
        document.getElementById("addressFullName").value = address.fullName || "";
        document.getElementById("addressPhone").value = address.phone || "";
        document.getElementById("addressStreet").value = address.street || "";
        document.getElementById("addressCity").value = address.city || "";
        document.getElementById("addressState").value = address.state || "";
        document.getElementById("addressPincode").value = address.pincode || "";
        document.getElementById("addressType").value = address.type || "Home";
        addressForm.elements.namedItem("isDefault").checked = Boolean(address.isDefault);
    }

    addressModal.classList.add("show");
    addressModal.setAttribute("aria-hidden", "false");
    document.getElementById("addressFullName").focus();
}

function closeAddressForm() {
    addressModal.classList.remove("show");
    addressModal.setAttribute("aria-hidden", "true");
    addressForm.reset();
    editingAddressId = null;
}

async function saveAddress(event) {
    event.preventDefault();

    if (!addressForm.reportValidity()) {
        return;
    }

    const missingField = [...addressForm.querySelectorAll("[required]")]
        .find((field) => !field.value.trim());
    if (missingField) {
        setMessage("Please complete all required fields.", "error");
        missingField.focus();
        return;
    }

    const formData = new FormData(addressForm);
    const payload = {
        fullName: formData.get("fullName").trim(),
        phone: formData.get("phone").trim(),
        street: formData.get("street").trim(),
        city: formData.get("city").trim(),
        state: formData.get("state").trim(),
        pincode: formData.get("pincode").trim(),
        type: formData.get("type"),
        isDefault: formData.get("isDefault") === "on"
    };

    addressSubmitButton.disabled = true;
    try {
        const isEditing = Boolean(editingAddressId);
        const url = isEditing
            ? `${ADDRESS_API_URL}/${encodeURIComponent(editingAddressId)}`
            : ADDRESS_API_URL;

        await addressRequest(url, {
            method: isEditing ? "PUT" : "POST",
            body: payload
        });

        closeAddressForm();
        await loadAddresses(isEditing ? "Address updated successfully." : "Address added successfully.");
    } catch (error) {
        console.error("Could not save address:", error);
        setMessage("Unable to save the address. Please try again.", "error");
    } finally {
        addressSubmitButton.disabled = false;
    }
}

async function handleAddressAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
        return;
    }

    const { action, addressId } = button.dataset;
    const address = addresses.find((item) => item._id === addressId);

    if (action === "edit" && address) {
        openAddressForm(address);
        return;
    }

    if (action === "delete") {
        if (!confirm("Delete this saved address?")) {
            return;
        }

        try {
            await addressRequest(`${ADDRESS_API_URL}/${encodeURIComponent(addressId)}`, {
                method: "DELETE"
            });
            await loadAddresses("Address deleted successfully.");
        } catch (error) {
            console.error("Could not delete address:", error);
            setMessage("Unable to delete the address. Please try again.", "error");
        }
        return;
    }

    if (action === "default") {
        try {
            await addressRequest(
                `${ADDRESS_API_URL}/${encodeURIComponent(addressId)}/default`,
                { method: "PUT" }
            );
            await loadAddresses("Default address updated.");
        } catch (error) {
            console.error("Could not update the default address:", error);
            setMessage("Unable to update the default address. Please try again.", "error");
        }
    }
}

const initialToken = localStorage.getItem("authToken");
if (!initialToken) {
    redirectToLogin();
} else {
    document.getElementById("addAddressBtn").addEventListener("click", () => openAddressForm());
    document.getElementById("closeAddressModal").addEventListener("click", closeAddressForm);
    document.getElementById("cancelAddressForm").addEventListener("click", closeAddressForm);
    addressesContainer.addEventListener("click", handleAddressAction);
    addressForm.addEventListener("submit", saveAddress);

    addressModal.addEventListener("click", (event) => {
        if (event.target === addressModal) {
            closeAddressForm();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && addressModal.classList.contains("show")) {
            closeAddressForm();
        }
    });

    document.getElementById("logoutBtn").addEventListener("click", (event) => {
        event.preventDefault();
        redirectToLogin();
    });

    loadAddresses();
}
