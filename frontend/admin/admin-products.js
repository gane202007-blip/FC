(() => {
  const accessMessage = document.getElementById("accessMessage");
  const dashboard = document.getElementById("dashboard");
  const productRows = document.getElementById("productRows");
  const productDialog = document.getElementById("productDialog");
  const productForm = document.getElementById("productForm");
  const formError = document.getElementById("formError");
  const dashboardError = document.getElementById("dashboardError");
  const searchInput = document.getElementById("productSearch");
  const allowedImageTypes = new Set([
    "image/avif",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  const imageFiles = document.getElementById("imageFiles");
  const imageDropZone = document.getElementById("imageDropZone");
  const imageUrlInput = document.getElementById("productImageUrl");
  const imagePreviews = document.getElementById("imagePreviews");

  let products = [];
  let selectedImages = [];

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

  const formatPrice = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

  async function initialize() {
    document.getElementById("logoutButton").addEventListener("click", () => {
      window.API.clearAuth();
      window.location.href = "../auth/login.html";
    });

    document.getElementById("addProductButton").addEventListener("click", () => openProductDialog());
    document.getElementById("closeDialogButton").addEventListener("click", closeProductDialog);
    document.getElementById("cancelDialogButton").addEventListener("click", closeProductDialog);
    document.getElementById("addImagesButton").addEventListener("click", () => imageFiles.click());
    document.getElementById("addImageUrlButton").addEventListener("click", addImageUrl);
    imageFiles.addEventListener("change", () => {
      addImageFiles(imageFiles.files);
      imageFiles.value = "";
    });
    imageDropZone.addEventListener("click", () => imageFiles.click());
    imageDropZone.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        imageFiles.click();
      }
    });
    imageDropZone.addEventListener("dragenter", handleImageDrag);
    imageDropZone.addEventListener("dragover", handleImageDrag);
    imageDropZone.addEventListener("dragleave", event => {
      if (!imageDropZone.contains(event.relatedTarget)) {
        imageDropZone.classList.remove("is-dragging");
      }
    });
    imageDropZone.addEventListener("drop", event => {
      event.preventDefault();
      event.stopPropagation();
      imageDropZone.classList.remove("is-dragging");
      addImageFiles(event.dataTransfer.files);
    });
    imagePreviews.addEventListener("click", removeImagePreview);
    productDialog.addEventListener("close", clearSelectedImages);
    document.addEventListener("dragover", preventFileNavigation, true);
    document.addEventListener("drop", preventFileNavigation, true);
    productForm.addEventListener("submit", saveProduct);
    searchInput.addEventListener("input", renderProducts);
    productRows.addEventListener("click", handleProductAction);

    const identity = await window.API.request("/auth/me", { auth: true });
    if (!identity.success || !identity.user) {
      if (identity.unauthorized) {
        window.location.href = "../auth/login.html";
        return;
      }
      showAccessMessage(identity.message || "Unable to verify your account.", true);
      return;
    }
    if (identity.user.role !== "admin") {
      showAccessMessage("Access denied. Sign in with an administrator account to manage products.", true);
      return;
    }

    document.getElementById("adminName").textContent = identity.user.name || "Administrator";
    accessMessage.classList.add("hidden");
    dashboard.classList.remove("hidden");
    await loadDashboard();
  }

  function showAccessMessage(message, isError = false) {
    accessMessage.textContent = message;
    accessMessage.classList.toggle("is-error", isError);
  }

  function showDashboardError(message) {
    dashboardError.textContent = message;
    dashboardError.classList.remove("hidden");
  }

  async function loadDashboard() {
    dashboardError.classList.add("hidden");
    const [productResult, summaryResult] = await Promise.all([
      window.API.request("/products"),
      window.API.request("/products/admin/summary", { auth: true }),
    ]);

    if (!productResult.success || !Array.isArray(productResult.products)) {
      showDashboardError(productResult.message || "Unable to load products.");
      return;
    }
    if (!summaryResult.success || !summaryResult.summary) {
      showDashboardError(summaryResult.message || "Unable to load inventory summary.");
      return;
    }

    products = productResult.products;
    const summary = summaryResult.summary;
    document.getElementById("totalProducts").textContent = String(summary.totalProducts);
    document.getElementById("lowStock").textContent = String(summary.lowStock);
    document.getElementById("outOfStock").textContent = String(summary.outOfStock);
    document.getElementById("categoryCount").textContent = String(summary.categories.length);
    document.getElementById("categoryOptions").innerHTML = summary.categories
      .map(({ category }) => `<option value="${escapeHtml(category)}"></option>`)
      .join("");
    renderProducts();
  }

  function renderProducts() {
    const term = searchInput.value.trim().toLowerCase();
    const filtered = products.filter((product) =>
      `${product.name} ${product.category}`.toLowerCase().includes(term)
    );
    document.getElementById("inventoryCount").textContent =
      `${filtered.length} product${filtered.length === 1 ? "" : "s"}`;
    document.getElementById("emptyInventory").classList.toggle("hidden", filtered.length !== 0);

    productRows.innerHTML = filtered.map((product) => {
      const stock = Number(product.stock) || 0;
      const stockClass = stock === 0 ? "is-out" : stock <= 10 ? "is-low" : "";
      const stockLabel = stock === 0 ? "Out of stock" : `${stock} in stock`;
      return `
        <tr>
          <td>
            <div class="inventory-product">
              <img src="${escapeHtml(window.API.safeProductImage(product.image))}" alt="" loading="lazy" />
              <div>
                <span class="inventory-product-name">${escapeHtml(product.name)}</span>
                ${product.badge ? `<span class="inventory-product-badge">${escapeHtml(product.badge)}</span>` : ""}
              </div>
            </div>
          </td>
          <td>${escapeHtml(product.category)}</td>
          <td>${formatPrice(product.price)}</td>
          <td><span class="stock-indicator ${stockClass}">${stockLabel}</span></td>
          <td>
            <div class="row-actions">
              <button class="row-action" type="button" data-action="edit" data-id="${Number(product.id)}">Edit</button>
              <button class="row-action row-action-delete" type="button" data-action="delete" data-id="${Number(product.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function openProductDialog(product) {
    productForm.reset();
    clearSelectedImages();
    formError.classList.add("hidden");
    document.getElementById("productId").value = product ? String(product.id) : "";
    document.getElementById("dialogTitle").textContent = product ? "Edit product" : "Add product";
    document.getElementById("saveProductButton").textContent = product ? "Save changes" : "Save product";
    document.getElementById("productName").value = product?.name || "";
    document.getElementById("productCategory").value = product?.category || "";
    document.getElementById("productPrice").value = product?.price ?? "";
    const savedImages = product?.images?.length
      ? product.images
      : product?.image
        ? [product.image]
        : [];
    selectedImages = savedImages.map(url => ({ url, preview: url }));
    renderImagePreviews();
    document.getElementById("productStock").value = product?.stock ?? 25;
    document.getElementById("productBadge").value = product?.badge || "";
    document.getElementById("productDescription").value = product?.description || "";
    productDialog.showModal();
  }

  function closeProductDialog() {
    if (productDialog.open) productDialog.close();
  }

  function handleImageDrag(event) {
    event.preventDefault();
    event.stopPropagation();
    imageDropZone.classList.add("is-dragging");
  }

  function preventFileNavigation(event) {
    if (Array.from(event.dataTransfer?.types || []).includes("Files")) {
      event.preventDefault();
    }
  }

  function addImageFiles(files) {
    const remaining = 10 - selectedImages.length;
    const accepted = Array.from(files).slice(0, remaining);
    const invalid = accepted.find(file =>
      !allowedImageTypes.has(file.type) || file.size > 5 * 1024 * 1024
    );
    if (files.length > remaining) {
      showImageError("A product can have up to 10 images.");
      return;
    }
    if (invalid) {
      showImageError("Choose image files no larger than 5 MB each.");
      return;
    }
    accepted.forEach(file => {
      selectedImages.push({
        file,
        preview: URL.createObjectURL(file)
      });
    });
    formError.classList.add("hidden");
    renderImagePreviews();
  }

  function addImageUrl() {
    const url = imageUrlInput.value.trim();
    if (!url) {
      showImageError("Enter an image URL first.");
      return;
    }
    if (selectedImages.length >= 10) {
      showImageError("A product can have up to 10 images.");
      return;
    }
    const isLocalImage = url.startsWith("/images/") &&
      !url.includes("\\") && !url.split("/").includes("..");
    let isHttpsImage = false;
    try {
      const parsedUrl = new URL(url);
      isHttpsImage = parsedUrl.protocol === "https:" &&
        !parsedUrl.username && !parsedUrl.password;
    } catch {
      // Invalid URLs are reported below.
    }
    if (!isLocalImage && !isHttpsImage) {
      showImageError("Use an HTTPS image URL or a path under /images/.");
      return;
    }
    selectedImages.push({ url, preview: url });
    imageUrlInput.value = "";
    formError.classList.add("hidden");
    renderImagePreviews();
  }

  function showImageError(message) {
    formError.textContent = message;
    formError.classList.remove("hidden");
  }

  function renderImagePreviews() {
    imagePreviews.innerHTML = selectedImages.map((image, index) => {
      const src = image.file
        ? image.preview
        : window.API.safeProductImage(image.url);
      return `
        <div class="image-preview">
          <img src="${escapeHtml(src)}" alt="Product image ${index + 1}" />
          <button class="image-preview-remove" type="button" data-image-index="${index}" aria-label="Remove image ${index + 1}">×</button>
        </div>
      `;
    }).join("");
  }

  function removeImagePreview(event) {
    const button = event.target.closest("button[data-image-index]");
    if (!button) return;
    const [image] = selectedImages.splice(Number(button.dataset.imageIndex), 1);
    if (image.file) URL.revokeObjectURL(image.preview);
    renderImagePreviews();
  }

  function clearSelectedImages() {
    selectedImages.forEach(image => {
      if (image.file) URL.revokeObjectURL(image.preview);
    });
    selectedImages = [];
    renderImagePreviews();
  }

  async function saveProduct(event) {
    event.preventDefault();
    formError.classList.add("hidden");

    const id = document.getElementById("productId").value;
    if (!selectedImages.length) {
      showImageError("Add at least one product image.");
      return;
    }
    const body = new FormData();
    body.append("name", document.getElementById("productName").value.trim());
    body.append("category", document.getElementById("productCategory").value.trim());
    body.append("price", document.getElementById("productPrice").value);
    body.append("stock", document.getElementById("productStock").value);
    body.append("badge", document.getElementById("productBadge").value.trim());
    body.append("description", document.getElementById("productDescription").value.trim());
    body.append("images", JSON.stringify(
      selectedImages.filter(image => !image.file).map(image => image.url)
    ));
    selectedImages.forEach(image => {
      if (image.file) body.append("imageFiles", image.file);
    });

    const button = document.getElementById("saveProductButton");
    button.disabled = true;
    button.textContent = id ? "Saving…" : "Adding…";

    try {
      const result = await window.API.request(
        id ? `/products/admin/${encodeURIComponent(id)}` : "/products/admin",
        { method: id ? "PUT" : "POST", body, auth: true }
      );
      if (!result.success) {
        formError.textContent = result.message || "Unable to save this product.";
        formError.classList.remove("hidden");
        return;
      }
      closeProductDialog();
      await loadDashboard();
    } finally {
      button.disabled = false;
      button.textContent = id ? "Save changes" : "Save product";
    }
  }

  async function handleProductAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const product = products.find((item) => Number(item.id) === Number(button.dataset.id));
    if (!product) return;

    if (button.dataset.action === "edit") {
      openProductDialog(product);
      return;
    }
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

    button.disabled = true;
    try {
      const result = await window.API.request(`/products/admin/${encodeURIComponent(product.id)}`, {
        method: "DELETE",
        auth: true,
      });
      if (!result.success) {
        showDashboardError(result.message || "Unable to delete this product.");
        button.disabled = false;
        return;
      }
      await loadDashboard();
    } catch (error) {
      showDashboardError(error.message || "Unable to delete this product.");
      button.disabled = false;
    }
  }

  initialize().catch((error) => {
    console.error("Admin product dashboard failed to initialize:", error);
    showAccessMessage("Unable to load the dashboard. Please refresh and try again.", true);
  });
})();
