const CART_KEY = 'ladiesFancyCart';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(product, quantity = 1) {
  const cart = getCart();
  const existing = cart.find((item) => item.id === product.id);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      quantity,
    });
  }

  saveCart(cart);
  return cart;
}

function removeFromCart(productId) {
  const cart = getCart().filter((item) => item.id !== productId);
  saveCart(cart);
  return cart;
}

function updateQuantity(productId, quantity) {
  const cart = getCart();
  const item = cart.find((i) => i.id === productId);

  if (!item) return cart;

  if (quantity <= 0) {
    return removeFromCart(productId);
  }

  item.quantity = quantity;
  saveCart(cart);
  return cart;
}

function clearCart() {
  saveCart([]);
}

function getCartTotal(cart = getCart()) {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function getCartCount(cart = getCart()) {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;

  const count = getCartCount();
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}

function formatPrice(amount) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('cartItems')) return;

  document.getElementById('cartItems').addEventListener('click', handleCartItemClick);
  document.getElementById('clearCartBtn')?.addEventListener('click', () => {
    clearCart();
    renderCartPage();
    showToast('Cart cleared');
  });

  renderCartPage();
});

function renderCartPage() {
  const cartItemsEl = document.getElementById('cartItems');
  const cartEmptyEl = document.getElementById('cartEmpty');
  const cartSummaryEl = document.getElementById('cartSummary');
  const cart = getCart();

  if (cart.length === 0) {
    cartItemsEl.innerHTML = '';
    cartEmptyEl?.classList.remove('hidden');
    cartSummaryEl?.classList.add('hidden');
    updateCartBadge();
    return;
  }

  cartEmptyEl?.classList.add('hidden');
  cartSummaryEl?.classList.remove('hidden');
  updateCartBadge();

  cartItemsEl.innerHTML = cart
    .map(
      (item) => `
        <article class="cart-item" data-id="${item.id}">
          <img src="${item.image}" alt="${item.name}" />
          <div class="cart-item-details">
            <h3>${item.name}</h3>
            <p class="product-category">${item.category}</p>
            <p class="product-price">${formatPrice(item.price)}</p>
          </div>
          <div class="cart-item-qty">
            <button class="qty-btn" data-action="decrease" type="button" aria-label="Decrease quantity">−</button>
            <span>${item.quantity}</span>
            <button class="qty-btn" data-action="increase" type="button" aria-label="Increase quantity">+</button>
          </div>
          <p class="cart-item-total">${formatPrice(item.price * item.quantity)}</p>
          <button class="remove-btn" type="button" aria-label="Remove item">&times;</button>
        </article>
      `
    )
    .join('');

  document.getElementById('subtotal').textContent = formatPrice(getCartTotal(cart));
  document.getElementById('grandTotal').textContent = formatPrice(getCartTotal(cart));
}

function handleCartItemClick(event) {
  const itemEl = event.target.closest('.cart-item');
  if (!itemEl) return;

  const id = Number(itemEl.dataset.id);
  const cart = getCart();
  const item = cart.find((i) => i.id === id);
  if (!item) return;

  if (event.target.closest('.remove-btn')) {
    removeFromCart(id);
    renderCartPage();
    showToast('Item removed');
    return;
  }

  const action = event.target.closest('.qty-btn')?.dataset.action;
  if (action === 'increase') updateQuantity(id, item.quantity + 1);
  if (action === 'decrease') updateQuantity(id, item.quantity - 1);
  renderCartPage();
}
