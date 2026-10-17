const wishlistGrid = document.getElementById('wishlistGrid');
const wishlistStatus = document.getElementById('wishlistStatus');
const wishlistEmpty = document.getElementById('wishlistEmpty');

let wishlistItems = [];

document.addEventListener('DOMContentLoaded', () => {
  wishlistGrid.addEventListener('click', handleWishlistClick);
  document.querySelector('.menu a[href="#"]')?.addEventListener('click', (event) => {
    event.preventDefault();
    if (window.confirm('Are you sure you want to log out?')) {
      window.WishlistAPI.redirectToLogin();
    }
  });
  loadWishlist();
  loadWishlistUser();
});

async function loadWishlistUser() {
  try {
    const result = await window.WishlistAPI.request('/auth/me');
    if (result.user) {
      document.getElementById('wishlistUserName').textContent = result.user.name || 'My Account';
      document.getElementById('wishlistUserEmail').textContent = result.user.email || '';
    }
  } catch (error) {
    console.error('Could not load wishlist account details:', error);
  }
}

async function loadWishlist() {
  wishlistGrid.replaceChildren();
  wishlistGrid.setAttribute('aria-busy', 'true');
  wishlistEmpty.classList.add('hidden');
  setWishlistStatus('Loading wishlist...');

  try {
    const result = await window.WishlistAPI.request('/wishlist');
    if (!Array.isArray(result.wishlist)) {
      throw new Error('The server returned an invalid wishlist response.');
    }

    wishlistItems = result.wishlist;
    renderWishlist();
  } catch (error) {
    console.error('Could not load wishlist:', error);
    setWishlistStatus(`Unable to load your wishlist. ${error.message}`);
  } finally {
    wishlistGrid.setAttribute('aria-busy', 'false');
  }
}

function renderWishlist() {
  wishlistGrid.replaceChildren(...wishlistItems.map(createWishlistCard));
  wishlistEmpty.classList.toggle('hidden', wishlistItems.length > 0);
  setWishlistStatus('');
}

function createWishlistCard(item) {
  const product = item.product;
  const card = document.createElement('article');
  card.className = 'wishlist-card';
  card.dataset.productId = item.productId;

  const image = document.createElement('img');
  image.src = window.API.safeProductImage(product.image);
  image.alt = product.name;
  card.append(image);

  const info = document.createElement('div');
  info.className = 'wishlist-info';

  const name = document.createElement('h3');
  name.textContent = product.name;
  info.append(name);

  const rating = document.createElement('div');
  rating.className = 'rating';
  const score = Number(product.rating) || 0;
  const fullStars = Math.floor(score);
  const hasHalfStar = score - fullStars >= 0.5;

  for (let index = 0; index < 5; index += 1) {
    const star = document.createElement('i');
    star.className = index < fullStars
      ? 'fas fa-star'
      : index === fullStars && hasHalfStar
        ? 'fas fa-star-half-alt'
        : 'far fa-star';
    rating.append(star);
  }

  const ratingText = document.createElement('span');
  ratingText.textContent = `(${score.toFixed(1)})`;
  rating.append(ratingText);
  info.append(rating);

  const price = document.createElement('p');
  price.className = 'price';
  price.textContent = `₹${Number(product.price).toLocaleString('en-IN')}`;
  info.append(price);

  const actions = document.createElement('div');
  actions.className = 'wishlist-actions';

  const cartButton = document.createElement('button');
  cartButton.className = 'cart-btn';
  cartButton.type = 'button';
  cartButton.dataset.action = 'move-to-cart';
  cartButton.innerHTML = '<i class="fas fa-cart-shopping"></i> Move to Cart';
  actions.append(cartButton);

  const removeButton = document.createElement('button');
  removeButton.className = 'remove-btn';
  removeButton.type = 'button';
  removeButton.dataset.action = 'remove';
  removeButton.setAttribute('aria-label', `Remove ${product.name} from wishlist`);
  removeButton.innerHTML = '<i class="fas fa-trash"></i>';
  actions.append(removeButton);

  info.append(actions);
  card.append(info);
  return card;
}

async function handleWishlistClick(event) {
  const button = event.target.closest('button[data-action]');
  const card = button?.closest('.wishlist-card');
  if (!button || !card) return;

  const productId = Number(card.dataset.productId);
  const item = wishlistItems.find((wishlistItem) => Number(wishlistItem.productId) === productId);
  if (!item) return;

  button.disabled = true;
  try {
    if (button.dataset.action === 'move-to-cart') {
      if (typeof addToCart !== 'function') {
        throw new Error('The cart is unavailable. Please try again.');
      }
      await addToCart({ ...item.product, id: productId });
    }

    await window.WishlistAPI.request(`/wishlist/${productId}`, { method: 'DELETE' });
    wishlistItems = wishlistItems.filter(
      (wishlistItem) => Number(wishlistItem.productId) !== productId
    );
    renderWishlist();
  } catch (error) {
    console.error('Could not update wishlist:', error);
    setWishlistStatus(`Unable to update your wishlist. ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

function setWishlistStatus(message) {
  wishlistStatus.textContent = message;
  wishlistStatus.hidden = !message;
}
