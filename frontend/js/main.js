/* ===========================================
   Ladies Fancy Store — Main Global JavaScript
   =========================================== */

document.addEventListener('DOMContentLoaded', () => {
  const pageLoader = document.getElementById('pageLoader');
  if (pageLoader) {
    setTimeout(() => pageLoader.classList.add('hidden'), 350);
  }

  if (typeof updateCartBadge === 'function') {
    updateCartBadge();
  }

  setActiveNavLink();
  initMobileNav();
  initAccountMenu();
  initFeaturedProducts();
});

function getBasePath() {
  const path = window.location.pathname;
  if (path.includes('/profile/') || path.includes('/auth/') || path.includes('/checkout/')) {
    return '../';
  }
  return '';
}

function setActiveNavLink() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-bar a').forEach((link) => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

function initMobileNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = nav.classList.toggle('active');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && !toggle.contains(e.target)) {
      nav.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('show');

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function formatPrice(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

// ===============================
// Account Menu (Desktop & Mobile)
// ===============================

function initAccountMenu() {
  const accountMenus = document.querySelectorAll('.account-menu');
  if (accountMenus.length === 0) return;

  const base = getBasePath();
  let user = null;

  if (window.API && typeof window.API.getUser === 'function') {
    user = window.API.getUser();
  } else {
    try {
      user = JSON.parse(localStorage.getItem('loggedInUser'));
    } catch {
      user = null;
    }
  }

  accountMenus.forEach((menu) => {
    const accountBtn = menu.querySelector('.account-btn');
    const accountText = menu.querySelector('#accountText') || menu.querySelector('.account-btn span');
    const dropdown = menu.querySelector('.account-dropdown');
    if (!dropdown) return;

    if (user && user.name) {
      if (accountText) {
        accountText.textContent = user.name.split(' ')[0];
      }

      dropdown.innerHTML = `
        ${user.role === 'admin' ? `<a href="${base}admin/products.html"><i class="fa-solid fa-boxes-stacked"></i> Manage Products</a>` : ''}
        <a href="${base}profile/profile.html"><i class="fa-solid fa-user"></i> My Profile</a>
        <a href="${base}profile/orders.html"><i class="fa-solid fa-box"></i> My Orders</a>
        <a href="${base}profile/addresses.html"><i class="fa-solid fa-location-dot"></i> Saved Addresses</a>
        <a href="${base}profile/wishlist.html"><i class="fa-solid fa-heart"></i> Wishlist</a>
        <a href="#" class="logout-link"><i class="fa-solid fa-right-from-bracket"></i> Logout</a>
      `;

      dropdown.querySelector('.logout-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to log out?')) {
          if (window.API) {
            window.API.clearAuth();
          } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('loggedInUser');
          }
          showToast('Logged out successfully');
          setTimeout(() => {
            window.location.href = `${base}auth/login.html`;
          }, 500);
        }
      });
    } else {
      if (accountText) {
        accountText.textContent = 'My Account';
      }
      dropdown.innerHTML = `
        <a href="${base}auth/login.html"><i class="fa-solid fa-arrow-right-to-bracket"></i> Login</a>
        <a href="${base}auth/signup.html"><i class="fa-solid fa-user-plus"></i> Create Account</a>
      `;
    }

    if (accountBtn) {
      accountBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.classList.toggle('open');
        dropdown.style.display = isOpen ? 'block' : '';
      });
    }
  });

  // Global click to close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    accountMenus.forEach((menu) => {
      if (!menu.contains(e.target)) {
        menu.classList.remove('open');
        const dropdown = menu.querySelector('.account-dropdown');
        if (dropdown) dropdown.style.display = '';
      }
    });
  });
}

// ===============================
// Homepage Featured Products
// ===============================

async function initFeaturedProducts() {
  const container = document.getElementById('featuredProducts');
  if (!container) return;

  let products = [];
  try {
    const res = await window.API.request('/products');
    if (res.success && Array.isArray(res.products)) {
      products = res.products;
    }
  } catch (err) {
    console.warn('API error fetching featured products:', err);
  }

  if (products.length === 0) {
    container.innerHTML = '<p class="empty-state">No featured products available at the moment.</p>';
    return;
  }

  // Filter for bestseller/new or take first 4 distinct categories
  const featured = products.filter((p) => p.badge || p.rating >= 4.7).slice(0, 4);
  const displayItems = featured.length >= 4 ? featured : products.slice(0, 4);
  const escape = window.API.escapeHtml;

  container.innerHTML = displayItems
    .map(
      (product) => `
      <article class="product-card" data-id="${product.id}">
        <div class="product-image-wrap">
          ${product.badge ? `<span class="product-badge">${escape(product.badge)}</span>` : ''}
          <a href="product-details.html?id=${product.id}">
            <img src="${escape(window.API.safeProductImage(product.image))}" alt="${escape(product.name)}" loading="lazy" />
          </a>
          <div class="product-overlay">
            <a href="product-details.html?id=${product.id}" class="btn btn-outline quick-view">View Details</a>
          </div>
        </div>
        <div class="product-info">
          <p class="product-category">${escape(product.category)}</p>
          <h3 class="product-name"><a href="product-details.html?id=${product.id}">${escape(product.name)}</a></h3>
          <p class="product-price">${formatPrice(product.price)}</p>
          <p class="product-rating">
            <span class="stars">${'★'.repeat(Math.floor(product.rating))}${'☆'.repeat(5 - Math.floor(product.rating))}</span>
            <span class="rating-value">${product.rating}</span>
          </p>
          <div class="product-actions">
            <button class="btn btn-primary add-to-cart" type="button" data-id="${product.id}"${Number(product.stock) < 1 ? ' disabled' : ''}>${Number(product.stock) < 1 ? 'Out of Stock' : 'Add to Cart'}</button>
          </div>
        </div>
      </article>
    `
    )
    .join('');

  // Attach event listener for Add to Cart on featured items
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('.add-to-cart');
    if (!btn || btn.disabled) return;
    const id = Number(btn.dataset.id);
    const item = displayItems.find((p) => p.id === id);
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