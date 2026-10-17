let cartItems = [];
let cartCount = 0;
let cartLoaded = false;
let cartDataVersion = 0;
let cartMutationQueue = Promise.resolve();
const STORE_WHATSAPP_PHONE = '8143108220';

function getCart() {
  return cartItems;
}

function getCartTotal(items = cartItems) {
  return items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
}

function getCartCount(items = cartItems) {
  return items.reduce((sum, item) => sum + Number(item.quantity), 0);
}

function formatPrice(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

async function cartRequest(endpoint, { method = 'GET', body } = {}) {
  try {
    if (!window.WishlistAPI) {
      throw new Error('The API client is unavailable. Please reload the page.');
    }
    return await window.WishlistAPI.request(endpoint, { method, body });
  } catch (error) {
    if (/authentication|required|session has expired/i.test(error.message)) {
      throw new Error('Please log in again to use your cart.');
    }
    if (/Wishlist request failed \(404\)/i.test(error.message)) {
      throw new Error('The product is unavailable or the cart item no longer exists.');
    }
    if (/Wishlist request failed \(400\)/i.test(error.message)) {
      throw new Error('The cart request was invalid or exceeds available stock.');
    }
    if (/failed to fetch|network|fetch/i.test(error.message)) {
      throw new Error('Unable to reach the server. Check your connection and try again.');
    }
    throw new Error('The cart could not be updated. Please try again.');
  }
}

function normalizeCartResponse(data) {
  if (!data?.cart || !Array.isArray(data.cart.items)) {
    throw new Error('The server returned invalid cart data.');
  }

  cartItems = data.cart.items;
  cartCount = Number.isInteger(data.cart.count) && data.cart.count >= 0
    ? data.cart.count
    : getCartCount();
  cartLoaded = true;
  updateCartBadge();
  renderCartPage();
  return cartItems;
}

async function loadCart() {
  const version = cartDataVersion;
  const result = await cartRequest('/cart');
  if (version !== cartDataVersion) {
    await cartMutationQueue;
    return cartLoaded ? cartItems : loadCart();
  }
  return normalizeCartResponse(result);
}

function queueCartMutation(operation) {
  cartDataVersion += 1;
  const queued = cartMutationQueue.then(operation, operation);
  cartMutationQueue = queued.catch(() => {});
  return queued;
}

function validateCartProduct(product, quantity) {
  if (!product || !Number.isSafeInteger(Number(product.id)) || Number(product.id) <= 0) {
    throw new Error('This product cannot be added to the cart.');
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('Quantity must be a positive whole number.');
  }
  if (!product.name || !product.image || !Number.isFinite(Number(product.price)) || Number(product.price) < 0) {
    throw new Error('Product details are incomplete. Please try again.');
  }
}

async function addToCart(product, quantity = 1) {
  validateCartProduct(product, quantity);
  return queueCartMutation(async () => {
    const result = await cartRequest('/cart', {
      method: 'POST',
      body: {
        item: {
          id: Number(product.id),
          name: product.name,
          price: Number(product.price),
          image: product.image,
          category: product.category || '',
          quantity
        }
      }
    });
    normalizeCartResponse(result);
    return cartItems;
  });
}

async function removeFromCart(productId) {
  const id = Number(productId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('This cart item is invalid.');
  }
  return queueCartMutation(async () => {
    const result = await cartRequest(`/cart/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return normalizeCartResponse(result);
  });
}

async function updateQuantity(productId, quantity) {
  const id = Number(productId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('This cart item is invalid.');
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error('Quantity must be at least 1.');
  }

  const item = cartItems.find((cartItem) => Number(cartItem.productId) === id);
  if (!item) {
    throw new Error('This item is no longer in your cart.');
  }

  return queueCartMutation(async () => {
    const result = await cartRequest('/cart', {
      method: 'POST',
      body: {
        item: {
          id,
          name: item.name,
          price: item.price,
          image: item.image,
          category: item.category || '',
          quantity
        },
        overrideQuantity: true
      },
    });
    return normalizeCartResponse(result);
  });
}

async function clearCart() {
  return queueCartMutation(async () => {
    const result = await cartRequest('/cart', { method: 'DELETE' });
    return normalizeCartResponse(result);
  });
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;

  const hasToken = Boolean(localStorage.getItem('authToken'));
  const count = cartLoaded && hasToken ? cartCount : 0;
  badge.textContent = String(count);
  badge.classList.toggle('hidden', count === 0);
}

function setCartStatus(message) {
  const status = document.getElementById('cartStatus');
  if (!status) return;
  status.textContent = message;
  status.hidden = !message;
}

function handleWhatsAppCheckout(event) {
  event.preventDefault();
  if (!cartLoaded || cartItems.length === 0) {
    setCartStatus(cartLoaded
      ? 'Your cart is empty. Add products before ordering via WhatsApp.'
      : 'Your cart is still loading. Please try again.');
    return;
  }

  const orderLines = cartItems
    .map((item) => `- ${item.name} x ${item.quantity}`)
    .join('\n');
  const message = `Hello Ladies Fancy Store, I would like to place an order:\n${orderLines}\nTotal: ${formatPrice(getCartTotal())}`;
  const whatsappUrl = `https://wa.me/${STORE_WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}

document.addEventListener('DOMContentLoaded', () => {
  const cartItemsEl = document.getElementById('cartItems');
  const clearButton = document.getElementById('clearCartBtn');
  const whatsappButton = document.getElementById('whatsappCheckoutBtn');
  const hasCartPage = Boolean(cartItemsEl);
  const hasToken = Boolean(localStorage.getItem('authToken'));

  updateCartBadge();

  if (hasCartPage) {
    cartItemsEl.addEventListener('click', handleCartItemClick);
    clearButton?.addEventListener('click', handleClearCart);
    whatsappButton?.addEventListener('click', handleWhatsAppCheckout);
    setCartStatus('Loading your cart...');
  }

  if (!hasToken && hasCartPage) {
    redirectCartToLogin();
    return;
  }

  if (hasToken) {
    loadCart().catch((error) => {
      console.error('Could not load cart:', error);
      if (!cartLoaded) {
        setCartStatus(error.message);
        const empty = document.getElementById('cartEmpty');
        empty?.classList.add('hidden');
      }
    }).finally(() => {
      cartItemsEl?.setAttribute('aria-busy', 'false');
    });
  } else if (hasCartPage) {
    renderCartPage();
  }
});

function renderCartPage() {
  const cartItemsEl = document.getElementById('cartItems');
  if (!cartItemsEl || !cartLoaded) return;

  setCartStatus('');
  const cartEmptyEl = document.getElementById('cartEmpty');
  const cartSummaryEl = document.getElementById('cartSummary');
  const isEmpty = cartItems.length === 0;

  cartItemsEl.replaceChildren();
  cartEmptyEl?.classList.toggle('hidden', !isEmpty);
  cartSummaryEl?.classList.toggle('hidden', isEmpty);
  updateCartBadge();

  if (isEmpty) {
    document.getElementById('subtotal').textContent = formatPrice(0);
    document.getElementById('grandTotal').textContent = formatPrice(0);
    return;
  }

  cartItems.forEach((item) => {
    const id = Number(item.productId);
    const article = document.createElement('article');
    article.className = 'cart-item';
    article.dataset.id = String(id);

    const image = document.createElement('img');
    image.src = item.image;
    image.alt = item.name;
    article.append(image);

    const details = document.createElement('div');
    details.className = 'cart-item-details';
    const name = document.createElement('h3');
    name.textContent = item.name;
    const category = document.createElement('p');
    category.className = 'product-category';
    category.textContent = item.category || '';
    const price = document.createElement('p');
    price.className = 'product-price';
    price.textContent = formatPrice(item.price);
    details.append(name, category, price);
    article.append(details);

    const quantity = document.createElement('div');
    quantity.className = 'cart-item-qty';
    const decrease = createQuantityButton('decrease', 'Decrease quantity');
    const quantityValue = document.createElement('span');
    quantityValue.textContent = String(item.quantity);
    const increase = createQuantityButton('increase', 'Increase quantity');
    increase.disabled = Number.isFinite(Number(item.stock)) &&
      Number(item.quantity) >= Number(item.stock);
    quantity.append(decrease, quantityValue, increase);
    article.append(quantity);

    const itemTotal = document.createElement('p');
    itemTotal.className = 'cart-item-total';
    itemTotal.textContent = formatPrice(Number(item.price) * Number(item.quantity));
    article.append(itemTotal);

    const remove = document.createElement('button');
    remove.className = 'remove-btn';
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${item.name}`);
    remove.textContent = '×';
    article.append(remove);

    cartItemsEl.append(article);
  });

  const subtotal = getCartTotal();
  document.getElementById('subtotal').textContent = formatPrice(subtotal);
  document.getElementById('grandTotal').textContent = formatPrice(subtotal);
}

function createQuantityButton(action, label) {
  const button = document.createElement('button');
  button.className = 'qty-btn';
  button.dataset.action = action;
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.textContent = action === 'increase' ? '+' : '−';
  return button;
}

async function handleClearCart() {
  const button = document.getElementById('clearCartBtn');
  if (button) button.disabled = true;
  setCartStatus('');

  try {
    await clearCart();
    showToast('Cart cleared');
  } catch (error) {
    console.error('Could not clear cart:', error);
    setCartStatus(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function handleCartItemClick(event) {
  const itemEl = event.target.closest('.cart-item');
  if (!itemEl) return;

  const id = Number(itemEl.dataset.id);
  const item = cartItems.find((cartItem) => Number(cartItem.productId) === id);
  if (!item) return;

  const actionButton = event.target.closest('button');
  if (!actionButton || actionButton.disabled) return;
  actionButton.disabled = true;
  setCartStatus('');

  try {
    if (actionButton.classList.contains('remove-btn')) {
      await removeFromCart(id);
      showToast('Item removed');
      return;
    }

    const action = actionButton.dataset.action;
    if (action === 'increase') {
      await updateQuantity(id, Number(item.quantity) + 1);
    } else if (action === 'decrease' && Number(item.quantity) > 1) {
      await updateQuantity(id, Number(item.quantity) - 1);
    }
  } catch (error) {
    console.error('Could not update cart:', error);
    setCartStatus(error.message);
  } finally {
    actionButton.disabled = false;
  }
}
