const ordersList = document.getElementById('ordersList');
const ordersMessage = document.getElementById('ordersMessage');
const ordersEmpty = document.getElementById('ordersEmpty');

document.addEventListener('DOMContentLoaded', () => {
  ordersList.addEventListener('click', handleOrderAction);
  loadOrders();
});

async function loadOrders() {
  ordersList.setAttribute('aria-busy', 'true');
  setOrdersMessage('Loading your orders...');
  ordersEmpty.hidden = true;

  try {
    const result = await window.WishlistAPI.request('/orders');
    if (!Array.isArray(result.orders)) {
      throw new Error('Invalid orders response.');
    }

    if (result.orders.length === 0) {
      setOrdersMessage('');
      ordersEmpty.hidden = false;
      return;
    }

    ordersList.replaceChildren(...result.orders.map(createOrderCard));
    setOrdersMessage('');
  } catch (error) {
    console.error('Could not load orders:', error);
    setOrdersMessage('Unable to load your orders right now. Please try again.');
  } finally {
    ordersList.setAttribute('aria-busy', 'false');
  }
}

function createOrderCard(order) {
  const firstItem = order.items?.[0];
  const card = document.createElement('article');
  card.className = 'order-card';

  const imageWrap = document.createElement('div');
  imageWrap.className = 'order-image';
  const image = document.createElement('img');
  image.src = firstItem?.image || '';
  image.alt = firstItem?.name || 'Order product';
  imageWrap.append(image);
  card.append(imageWrap);

  const details = document.createElement('div');
  details.className = 'order-details';
  const title = document.createElement('h2');
  title.textContent = firstItem?.name || 'Order';
  details.append(title);

  const info = document.createElement('div');
  info.className = 'order-info';
  info.append(
    createOrderInfo('Order ID:', order.orderId),
    createOrderInfo('Date:', formatOrderDate(order.createdAt)),
    createOrderInfo('Total:', formatOrderPrice(order.total)),
    createOrderInfo('Items:', String((order.items || []).reduce(
      (count, item) => count + Number(item.quantity || 0),
      0
    )))
  );

  const statusInfo = document.createElement('p');
  const label = document.createElement('strong');
  label.textContent = 'Status: ';
  const status = document.createElement('span');
  status.className = `status ${String(order.status || '').toLowerCase()}`;
  status.textContent = order.status || 'Processing';
  statusInfo.append(label, status);
  info.append(statusInfo);
  details.append(info);

  const itemDetails = document.createElement('div');
  itemDetails.className = 'order-item-details';
  itemDetails.hidden = true;
  itemDetails.setAttribute('aria-live', 'polite');
  details.append(itemDetails);
  card.append(details);

  const action = document.createElement('div');
  action.className = 'order-action';
  const button = document.createElement('button');
  button.className = 'details-btn';
  button.type = 'button';
  button.dataset.orderId = order.orderId || order._id;
  button.textContent = 'View Details';
  action.append(button);
  card.append(action);
  return card;
}

function createOrderInfo(label, value) {
  const paragraph = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = `${label} `;
  paragraph.append(strong, document.createTextNode(value || '—'));
  return paragraph;
}

async function handleOrderAction(event) {
  const button = event.target.closest('.details-btn');
  if (!button || button.disabled) return;

  const card = button.closest('.order-card');
  const details = card.querySelector('.order-item-details');
  if (!details.hidden) {
    details.hidden = true;
    button.textContent = 'View Details';
    return;
  }

  button.disabled = true;
  button.textContent = 'Loading...';
  try {
    const result = await window.WishlistAPI.request(
      `/orders/${encodeURIComponent(button.dataset.orderId)}`
    );
    if (!result.order || !Array.isArray(result.order.items)) {
      throw new Error('Invalid order details response.');
    }

    renderOrderItems(details, result.order);
    details.hidden = false;
    button.textContent = 'Hide Details';
  } catch (error) {
    console.error('Could not load order details:', error);
    details.textContent = 'Unable to load order details right now.';
    details.hidden = false;
    button.textContent = 'Retry Details';
  } finally {
    button.disabled = false;
  }
}

function renderOrderItems(container, order) {
  const content = document.createDocumentFragment();

  order.items.forEach((item) => {
    const row = document.createElement('p');
    row.textContent = `${item.name} · Qty ${item.quantity} · ${formatOrderPrice(item.price)} each`;
    content.append(row);
  });

  const total = document.createElement('p');
  total.textContent = `Subtotal ${formatOrderPrice(order.subtotal)} · Total ${formatOrderPrice(order.total)}`;
  content.append(total);
  container.replaceChildren(content);
}

function formatOrderDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatOrderPrice(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function setOrdersMessage(message) {
  ordersMessage.textContent = message;
  ordersMessage.hidden = !message;
}
