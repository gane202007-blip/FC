/* ===========================================
   Ladies Fancy Store — Product Detail Logic
   =========================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = Number(urlParams.get('id'));

  if (!Number.isSafeInteger(productId) || productId <= 0) {
    showProductNotFound();
    return;
  }

  await loadProductDetails(productId);
});

let currentProduct = null;
let selectedQuantity = 1;
let isProductWishlisted = false;

async function loadProductDetails(productId) {
  let product = null;

  try {
    const res = await window.API.request(`/products/${productId}`);
    if (res.success && res.product) {
      product = res.product;
    }
  } catch (err) {
    console.warn('API error loading product detail:', err);
  }

  if (!product) {
    showProductNotFound();
    return;
  }

  currentProduct = product;
  renderProductInfo(product);
  checkWishlistStatus(product.id);
  bindDetailEvents();
  loadRelatedProducts(product.category, product.id);
}

function showProductNotFound() {
  const container = document.getElementById('productDetailContainer');
  if (!container) return;
  container.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
      <h2>Product Not Found</h2>
      <p style="margin: 15px 0 25px; color: #666;">The product you are looking for is unavailable or has been moved.</p>
      <a href="products.html" class="btn btn-primary">Back to All Products</a>
    </div>
  `;
}

function renderProductInfo(product) {
  document.title = `${product.name} | Ladies Fancy Store`;

  const breadcrumbCategory = document.getElementById('breadcrumbCategory');
  if (breadcrumbCategory) {
    breadcrumbCategory.innerHTML = `<a href="products.html?category=${encodeURIComponent(product.category)}">${window.API.escapeHtml(product.category)}</a>`;
  }

  const breadcrumbTitle = document.getElementById('breadcrumbTitle');
  if (breadcrumbTitle) {
    breadcrumbTitle.textContent = product.name;
  }

  const img = document.getElementById('detailImage');
  if (img) {
    img.src = window.API.safeProductImage(product.image);
    img.alt = product.name;
  }

  const cat = document.getElementById('detailCategory');
  if (cat) cat.textContent = product.category;

  const name = document.getElementById('detailName');
  if (name) name.textContent = product.name;

  const price = document.getElementById('detailPrice');
  if (price) price.textContent = formatPrice(product.price);

  const desc = document.getElementById('detailDesc');
  if (desc) {
    desc.textContent =
      product.description ||
      `Experience unmatched elegance with our ${product.name}. Designed with meticulous attention to detail and premium materials, this piece from our ${product.category} collection is perfect for special events or daily luxury.`;
  }

  const ratingEl = document.getElementById('detailRating');
  if (ratingEl) {
    const full = Math.floor(product.rating || 4.5);
    const stars = '★'.repeat(full) + '☆'.repeat(5 - full);
    ratingEl.innerHTML = `
      <span class="stars" style="color:#f59e0b; font-size:1.1rem;">${stars}</span>
      <strong style="margin-left: 6px;">${product.rating || 4.5}</strong>
      <span style="color: #777; margin-left: 6px;">(Verified Customer Reviews)</span>
    `;
  }

  const stockBadge = document.querySelector('.detail-stock-badge');
  const addButton = document.getElementById('detailAddToCartBtn');
  const outOfStock = Number(product.stock) < 1;
  if (stockBadge) {
    const icon = document.createElement('i');
    icon.className = outOfStock ? 'fa-solid fa-circle-xmark' : 'fa-solid fa-circle-check';
    stockBadge.replaceChildren(icon, document.createTextNode(outOfStock ? ' Out of Stock' : ' In Stock'));
  }
  if (addButton) {
    addButton.disabled = outOfStock;
    if (outOfStock) {
      addButton.textContent = 'Out of Stock';
    }
  }
  updateDetailQuantityControls();
}

function updateDetailQuantityControls() {
  const maxStock = Number(currentProduct?.stock) || 0;
  const minus = document.getElementById('qtyMinus');
  const plus = document.getElementById('qtyPlus');
  const quantity = document.getElementById('qtyVal');

  if (quantity) quantity.textContent = String(selectedQuantity);
  if (minus) minus.disabled = selectedQuantity <= 1;
  if (plus) plus.disabled = selectedQuantity >= maxStock;
}

async function checkWishlistStatus(productId) {
  isProductWishlisted = false;

  if (localStorage.getItem('authToken')) {
    try {
      const res = await window.WishlistAPI.request('/wishlist');
      if (Array.isArray(res.wishlist)) {
        isProductWishlisted = res.wishlist.some(
          (item) => Number(item.productId) === productId
        );
      }
    } catch (error) {
      console.error('Wishlist status check failed:', error);
    }
  }

  updateWishlistButtonUI();
}

function updateWishlistButtonUI() {
  const btn = document.getElementById('detailWishlistBtn');
  if (!btn) return;

  btn.classList.toggle('active', isProductWishlisted);
  btn.setAttribute('aria-pressed', String(isProductWishlisted));
  const icon = btn.querySelector('i');
  if (icon) {
    icon.className = isProductWishlisted ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
  }
}

function bindDetailEvents() {
  const minus = document.getElementById('qtyMinus');
  const plus = document.getElementById('qtyPlus');
  const addBtn = document.getElementById('detailAddToCartBtn');
  const wishlistBtn = document.getElementById('detailWishlistBtn');

  minus?.addEventListener('click', () => {
    if (selectedQuantity > 1) {
      selectedQuantity--;
      updateDetailQuantityControls();
    }
  });

  plus?.addEventListener('click', () => {
    const maxStock = Number(currentProduct?.stock) || 0;
    if (selectedQuantity < maxStock) {
      selectedQuantity++;
      updateDetailQuantityControls();
    } else {
      showToast(`Maximum stock limit of ${maxStock} reached`);
    }
  });

  addBtn?.addEventListener('click', async () => {
    if (!currentProduct) return;
    if (typeof addToCart === 'function') {
      addBtn.disabled = true;
      try {
        await addToCart(currentProduct, selectedQuantity);
        showToast(`${selectedQuantity} × ${currentProduct.name} added to cart!`);
      } catch (error) {
        showToast(error.message || 'Unable to add this product to your cart.');
      } finally {
        addBtn.disabled = false;
      }
    }
  });

  wishlistBtn?.addEventListener('click', async () => {
    if (!currentProduct || wishlistBtn.disabled) return;

    wishlistBtn.disabled = true;
    try {
      if (isProductWishlisted) {
        await window.WishlistAPI.request(`/wishlist/${currentProduct.id}`, {
          method: 'DELETE'
        });
      } else {
        await window.WishlistAPI.request('/wishlist', {
          method: 'POST',
          body: {
            productId: currentProduct.id,
            product: {
              name: currentProduct.name,
              price: currentProduct.price,
              image: currentProduct.image,
              category: currentProduct.category,
              rating: currentProduct.rating
            }
          }
        });
      }

      isProductWishlisted = !isProductWishlisted;
      updateWishlistButtonUI();
      showToast(isProductWishlisted ? 'Added to Wishlist!' : 'Removed from Wishlist');
    } catch (error) {
      console.error('Wishlist update failed:', error);
      showToast(error.message || 'Unable to update your wishlist.');
    } finally {
      wishlistBtn.disabled = false;
    }
  });
}

async function loadRelatedProducts(category, excludeId) {
  const container = document.getElementById('relatedProductsGrid');
  if (!container) return;

  let all = [];
  try {
    const res = await window.API.request(`/products?category=${encodeURIComponent(category)}`);
    if (res.success && Array.isArray(res.products)) {
      all = res.products;
    }
  } catch (error) {
    console.error('Could not load related products:', error);
  }

  const related = all.filter((p) => p.category === category && p.id !== excludeId).slice(0, 4);

  if (related.length === 0) {
    container.parentElement.style.display = 'none';
    return;
  }

  container.innerHTML = related
    .map(
      (p) => {
        const escape = window.API.escapeHtml;
        return `
      <article class="product-card" data-id="${p.id}">
        <div class="product-image-wrap">
          ${p.badge ? `<span class="product-badge">${escape(p.badge)}</span>` : ''}
          <a href="product-details.html?id=${p.id}">
            <img src="${escape(window.API.safeProductImage(p.image))}" alt="${escape(p.name)}" loading="lazy" />
          </a>
          <div class="product-overlay">
            <a href="product-details.html?id=${p.id}" class="btn btn-outline quick-view">View Details</a>
          </div>
        </div>
        <div class="product-info">
          <p class="product-category">${escape(p.category)}</p>
          <h3 class="product-name"><a href="product-details.html?id=${p.id}">${escape(p.name)}</a></h3>
          <p class="product-price">${formatPrice(p.price)}</p>
          <div class="product-actions">
            <button class="btn btn-primary add-related-cart" data-id="${p.id}" type="button"${Number(p.stock) < 1 ? ' disabled' : ''}>${Number(p.stock) < 1 ? 'Out of Stock' : 'Add to Cart'}</button>
          </div>
        </div>
      </article>
    `;
      }
    )
    .join('');

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('.add-related-cart');
    if (!btn || btn.disabled) return;
    const id = Number(btn.dataset.id);
    const item = related.find((p) => p.id === id);
    if (item && typeof addToCart === 'function') {
      btn.disabled = true;
      try {
        await addToCart(item);
        showToast(`${item.name} added to cart!`);
      } catch (error) {
        showToast(error.message || 'Unable to add this product to your cart.');
      } finally {
        btn.disabled = false;
      }
    }
  });
}
