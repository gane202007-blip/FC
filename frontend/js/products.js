const ITEMS_PER_PAGE = 8;
const CATEGORIES = [
  'All Products',
  'Bangles',
  'Earrings',
  'Necklaces',
  'Hair Accessories',
  'Handbags',
  'Cosmetics',
  'Gift Items',
];

let allProducts = [];
let currentCategory = 'All Products';
let currentSearch = '';
let currentPage = 1;

const grid = document.getElementById('productGrid');
const pagination = document.getElementById('pagination');
const resultsCount = document.getElementById('resultsCount');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('productSearch');
const modal = document.getElementById('quickViewModal');
const modalBody = document.getElementById('modalBody');

document.addEventListener('DOMContentLoaded', async () => {
  if (!grid) return;

  try {
    const response = await fetch('data/products.json');
    allProducts = await response.json();
  } catch {
    allProducts = [];
  }

  initCategoryFromUrl();
  renderCategorySidebar();
  bindEvents();
  renderProducts();
});

function initCategoryFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');
  if (category && CATEGORIES.includes(category)) {
    currentCategory = category;
  }
}

function renderCategorySidebar() {
  const list = document.getElementById('categoryList');
  if (!list) return;

  list.innerHTML = CATEGORIES.map(
    (cat) => `
      <li>
        <button
          class="category-btn${cat === currentCategory ? ' active' : ''}"
          data-category="${cat}"
          type="button"
        >${cat}</button>
      </li>
    `
  ).join('');
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const stars = '★'.repeat(full) + '☆'.repeat(5 - full);
  return `<span class="stars" aria-label="${rating} out of 5 stars">${stars}</span> <span class="rating-value">${rating}</span>`;
}

function getFilteredProducts() {
  return allProducts.filter((product) => {
    const matchCategory =
      currentCategory === 'All Products' || product.category === currentCategory;
    const matchSearch = product.name.toLowerCase().includes(currentSearch.toLowerCase());
    return matchCategory && matchSearch;
  });
}

function renderProducts() {
  const filtered = getFilteredProducts();
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  currentPage = Math.min(currentPage, totalPages);

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

  grid.innerHTML = pageItems
    .map(
      (product) => `
        <article class="product-card" data-id="${product.id}">
          <div class="product-image-wrap">
            ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
            <img src="${product.image}" alt="${product.name}" loading="lazy" />
            <div class="product-overlay">
              <button class="btn btn-outline quick-view" type="button">Quick View</button>
            </div>
          </div>
          <div class="product-info">
            <p class="product-category">${product.category}</p>
            <h3 class="product-name">${product.name}</h3>
            <p class="product-price">${formatPrice(product.price)}</p>
            <p class="product-rating">${renderStars(product.rating)}</p>
            <div class="product-actions">
              <button class="btn btn-primary add-to-cart" type="button">Add to Cart</button>
            </div>
          </div>
        </article>
      `
    )
    .join('');

  emptyState?.classList.toggle('hidden', pageItems.length > 0);
  grid.classList.toggle('hidden', pageItems.length === 0);

  if (resultsCount) {
    resultsCount.textContent = `Showing ${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
  }

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  if (!pagination) return;

  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = `<button class="page-btn" data-page="prev" type="button"${currentPage === 1 ? ' disabled' : ''}>‹ Prev</button>`;

  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn${i === currentPage ? ' active' : ''}" data-page="${i}" type="button">${i}</button>`;
  }

  html += `<button class="page-btn" data-page="next" type="button"${currentPage === totalPages ? ' disabled' : ''}>Next ›</button>`;
  pagination.innerHTML = html;
}

function openQuickView(product) {
  if (!modal || !modalBody) return;

  modalBody.innerHTML = `
    <img src="${product.image}" alt="${product.name}" />
    <p class="product-category">${product.category}</p>
    <h2>${product.name}</h2>
    <p class="product-price">${formatPrice(product.price)}</p>
    <p class="product-rating">${renderStars(product.rating)}</p>
    <p class="modal-desc">Premium quality ${product.category.toLowerCase()} — perfect for parties, weddings, and everyday elegance.</p>
    <button class="btn btn-primary add-to-cart" data-id="${product.id}" type="button">Add to Cart</button>
  `;

  modal.classList.remove('hidden');
}

function bindEvents() {
  document.getElementById('categoryList')?.addEventListener('click', (event) => {
    const btn = event.target.closest('.category-btn');
    if (!btn) return;

    document.querySelectorAll('.category-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.dataset.category;
    currentPage = 1;
    renderProducts();
  });

  searchInput?.addEventListener('input', (event) => {
    currentSearch = event.target.value.trim();
    currentPage = 1;
    renderProducts();
  });

  pagination?.addEventListener('click', (event) => {
    const btn = event.target.closest('.page-btn');
    if (!btn || btn.disabled) return;

    const page = btn.dataset.page;
    if (page === 'prev') currentPage -= 1;
    else if (page === 'next') currentPage += 1;
    else currentPage = Number(page);

    renderProducts();
    document.querySelector('.products-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.querySelector('.sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('categorySidebar')?.classList.toggle('open');
  });

  grid?.addEventListener('click', (event) => {
    const card = event.target.closest('.product-card');
    if (!card) return;

    const product = allProducts.find((p) => p.id === Number(card.dataset.id));
    if (!product) return;

    if (event.target.closest('.quick-view')) {
      openQuickView(product);
    }

    if (event.target.closest('.add-to-cart')) {
      addToCart(product);
      showToast(`${product.name} added to cart!`);
    }
  });

  modalBody?.addEventListener('click', (event) => {
    if (!event.target.closest('.add-to-cart')) return;

    const id = Number(event.target.dataset.id);
    const product = allProducts.find((p) => p.id === id);
    if (product) {
      addToCart(product);
      showToast(`${product.name} added to cart!`);
    }
  });

  document.getElementById('modalClose')?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });

  modal?.addEventListener('click', (event) => {
    if (event.target === modal) modal.classList.add('hidden');
  });
}
