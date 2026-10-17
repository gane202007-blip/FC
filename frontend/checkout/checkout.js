const checkoutAddressList = document.getElementById('checkoutAddresses');
const checkoutItemsList = document.getElementById('checkoutItems');
const checkoutMessage = document.getElementById('checkoutMessage');
const placeOrderButton = document.getElementById('placeOrderBtn');
const couponInput = document.querySelector('.coupon-box input');
const applyCouponButton = document.getElementById('applyCouponBtn');
const CHECKOUT_REQUEST_ID_KEY = 'ladiesFancyCheckoutRequestId';

let savedAddresses = [];
let checkoutCart = null;
let appliedCoupon = '';
let isSubmittingOrder = false;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('addCheckoutAddressBtn').addEventListener('click', () => {
    window.location.href = '../profile/addresses.html';
  });
  applyCouponButton.addEventListener('click', applyCheckoutCoupon);
  placeOrderButton.addEventListener('click', submitOrder);
  loadCheckout();
});

async function loadCheckout() {
  setCheckoutMessage('Loading your cart and saved addresses...', '');
  placeOrderButton.disabled = true;
  checkoutAddressList.setAttribute('aria-busy', 'true');
  checkoutItemsList.setAttribute('aria-busy', 'true');

  try {
    const [cartResult, addressResult] = await Promise.all([
      window.WishlistAPI.request('/cart'),
      window.WishlistAPI.request('/address')
    ]);

    if (!cartResult.cart || !Array.isArray(cartResult.cart.items) ||
        !Array.isArray(addressResult.addresses)) {
      throw new Error('Invalid checkout data.');
    }

    checkoutCart = cartResult.cart;
    savedAddresses = addressResult.addresses;
    renderCheckoutCart();
    renderCheckoutAddresses();

    if (checkoutCart.items.length === 0) {
      setCheckoutMessage('Your cart is empty. Add products before placing an order.', 'error');
      return;
    }
    const unavailableItem = checkoutCart.items.find((item) =>
      !Number.isSafeInteger(Number(item.stock)) ||
      Number(item.stock) < Number(item.quantity)
    );
    if (unavailableItem) {
      setCheckoutMessage(
        'One or more products no longer have enough stock. Update your cart before placing the order.',
        'error'
      );
      return;
    }
    if (savedAddresses.length === 0) {
      setCheckoutMessage('Add a delivery address before placing your order.', 'error');
      return;
    }

    placeOrderButton.disabled = false;
    setCheckoutMessage('', '');
  } catch (error) {
    console.error('Could not load checkout:', error);
    setCheckoutMessage('Unable to load checkout details. Please try again.', 'error');
  } finally {
    checkoutAddressList.setAttribute('aria-busy', 'false');
    checkoutItemsList.setAttribute('aria-busy', 'false');
  }
}

function renderCheckoutAddresses() {
  if (savedAddresses.length === 0) {
    checkoutAddressList.textContent = 'No saved delivery addresses.';
    return;
  }

  const selectedId = (savedAddresses.find((address) => address.isDefault) || savedAddresses[0])._id;
  checkoutAddressList.replaceChildren(...savedAddresses.map((address) => {
    const card = document.createElement('label');
    card.className = 'address-card';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'checkoutAddress';
    radio.value = address._id;
    radio.checked = address._id === selectedId;

    const content = document.createElement('div');
    const name = document.createElement('h3');
    name.textContent = `${address.fullName}${address.type ? ` · ${address.type}` : ''}`;
    const location = document.createElement('p');
    location.textContent = [
      address.street,
      address.city,
      address.state,
      address.pincode
    ].filter(Boolean).join(', ');
    const phone = document.createElement('p');
    phone.textContent = `Mobile: ${address.phone}`;
    content.append(name, location, phone);

    card.append(radio, content);
    return card;
  }));
}

function renderCheckoutCart() {
  const items = checkoutCart.items;
  checkoutItemsList.replaceChildren(...items.map((item) => {
    const row = document.createElement('div');
    row.className = 'product-item';

    const image = document.createElement('img');
    image.src = window.API.safeProductImage(item.image);
    image.alt = item.name;

    const details = document.createElement('div');
    details.className = 'product-details';
    const name = document.createElement('h3');
    name.textContent = item.name;
    const quantity = document.createElement('p');
    quantity.textContent = `Qty: ${item.quantity}`;
    const lineTotal = document.createElement('h4');
    lineTotal.textContent = formatCheckoutPrice(Number(item.price) * Number(item.quantity));
    details.append(name, quantity, lineTotal);
    row.append(image, details);
    return row;
  }));

  updateCheckoutTotals();
}

function applyCheckoutCoupon() {
  const value = couponInput.value.trim().toUpperCase();
  if (value !== 'WELCOME10') {
    appliedCoupon = '';
    updateCheckoutTotals();
    setCheckoutMessage(value ? 'That coupon code is not valid.' : 'Enter a coupon code first.', 'error');
    return;
  }

  appliedCoupon = value;
  updateCheckoutTotals();
  setCheckoutMessage('Coupon applied.', 'success');
}

function updateCheckoutTotals() {
  const subtotal = Number(checkoutCart?.subtotal) || 0;
  const discount = appliedCoupon === 'WELCOME10' ? Math.round(subtotal * 0.1) : 0;
  document.getElementById('checkoutSubtotal').textContent = formatCheckoutPrice(subtotal);
  document.getElementById('checkoutDiscount').textContent = `-${formatCheckoutPrice(discount)}`;
  document.getElementById('checkoutTotal').textContent = formatCheckoutPrice(Math.max(0, subtotal - discount));
}

async function submitOrder() {
  if (isSubmittingOrder || placeOrderButton.disabled) return;

  const addressId = document.querySelector('input[name="checkoutAddress"]:checked')?.value;
  const address = savedAddresses.find((savedAddress) => savedAddress._id === addressId);
  if (!address) {
    setCheckoutMessage('Select a valid delivery address.', 'error');
    return;
  }
  if (!checkoutCart?.items.length) {
    setCheckoutMessage('Your cart is empty. Add products before placing an order.', 'error');
    return;
  }

  isSubmittingOrder = true;
  placeOrderButton.disabled = true;
  setCheckoutMessage('Placing your order...', '');

  try {
    const result = await window.WishlistAPI.request('/orders', {
      method: 'POST',
      body: {
        checkoutRequestId: getCheckoutRequestId(),
        shippingAddress: {
          fullName: address.fullName,
          phone: address.phone,
          street: address.street,
          city: address.city,
          state: address.state,
          pincode: address.pincode
        },
        paymentMethod: 'COD',
        ...(appliedCoupon ? { couponCode: appliedCoupon } : {})
      }
    });

    if (!result.order || !result.order.orderId) {
      throw new Error('The order response was incomplete.');
    }

    document.getElementById('successOrderId').textContent = result.order.orderId;
    document.getElementById('checkoutSubtotal').textContent =
      formatCheckoutPrice(result.order.subtotal);
    document.getElementById('checkoutDiscount').textContent =
      `-${formatCheckoutPrice(result.order.discount)}`;
    document.getElementById('checkoutTotal').textContent =
      formatCheckoutPrice(result.order.total);
    document.getElementById('checkoutSuccess').hidden = false;
    sessionStorage.removeItem(CHECKOUT_REQUEST_ID_KEY);
    setCheckoutMessage('Your order has been placed.', 'success');
    document.querySelectorAll('.progress-section .step').forEach((step) => {
      step.classList.add('active');
    });
  } catch (error) {
    console.error('Could not place order:', error);
    setCheckoutMessage('Your order could not be placed. Please check your cart and try again.', 'error');
    placeOrderButton.disabled = false;
  } finally {
    isSubmittingOrder = false;
  }
}

function setCheckoutMessage(message, type) {
  checkoutMessage.textContent = message;
  checkoutMessage.className = `checkout-message${type ? ` ${type}` : ''}`;
}

function formatCheckoutPrice(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function getCheckoutRequestId() {
  let checkoutRequestId = sessionStorage.getItem(CHECKOUT_REQUEST_ID_KEY);

  if (!checkoutRequestId) {
    checkoutRequestId = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(CHECKOUT_REQUEST_ID_KEY, checkoutRequestId);
  }

  return checkoutRequestId;
}
