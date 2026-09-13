document.addEventListener('DOMContentLoaded', () => {
  const pageLoader = document.getElementById('pageLoader');
  if (pageLoader) {
    setTimeout(() => pageLoader.classList.add('hidden'), 500);
  }

  updateCartBadge();
  setActiveNavLink();
  initMobileNav();
  initCountdown();
});

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

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function initCountdown() {
  const daysEl = document.getElementById('days');
  if (!daysEl) return;

  const countdownTarget = new Date();
  countdownTarget.setHours(countdownTarget.getHours() + 72);

  function updateCountdown() {
    const now = new Date();
    const diff = countdownTarget.getTime() - now.getTime();

    if (diff <= 0) {
      ['days', 'hours', 'minutes', 'seconds'].forEach((id) => {
        document.getElementById(id).textContent = '00';
      });
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    document.getElementById('days').textContent = String(days).padStart(2, '0');
    document.getElementById('hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
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

// ===============================
// Account Menu
// ===============================

const accountText = document.getElementById("accountText");
const accountDropdown = document.getElementById("accountDropdown");

if (accountText && accountDropdown) {

    const user = JSON.parse(localStorage.getItem("loggedInUser"));

    if (user) {

        accountText.textContent = user.name;

        accountDropdown.innerHTML = `
            <a href="profile/profile.html">My Profile</a>
            <a href="profile/orders.html">My Orders</a>
            <a href="profile/wishlist.html">Wishlist</a>
            <a href="#" id="logoutLink">Logout</a>
        `;

        document.getElementById("logoutLink").addEventListener("click", function (e) {

            e.preventDefault();

            localStorage.removeItem("loggedInUser");

            window.location.href = "auth/login.html";

        });

    } else {

        accountDropdown.innerHTML = `
            <a href="auth/login.html">Login</a>
            <a href="auth/signup.html">Create Account</a>
        `;

    }

}