(function () {
  const API_BASE = window.API.BASE_URL;

  function redirectToLogin() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('loggedInUser');

    const loginPath = window.location.pathname.includes('/profile/') ||
      window.location.pathname.includes('/checkout/')
      ? '../auth/login.html'
      : 'auth/login.html';
    window.location.href = loginPath;
  }

  async function request(endpoint, { method = 'GET', body } = {}) {
    const token = localStorage.getItem('authToken');
    if (!token) {
      redirectToLogin();
      throw new Error('Authentication required. Redirecting to login.');
    }

    const headers = {
      Authorization: `Bearer ${token}`
    };
    const options = { method, headers };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();

    if (response.status === 401) {
      redirectToLogin();
      throw new Error('Your session has expired. Redirecting to login.');
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.message || `Wishlist request failed (${response.status}).`);
    }

    return data;
  }

  window.WishlistAPI = { request, redirectToLogin };
})();
