<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Checkout | Ladies Fancy Store</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <div class="page-loader" id="pageLoader"><div class="spinner"></div></div>

  <header class="site-header">
    <div class="container header-inner">
      <a href="index.html" class="brand">
        <img src="images/logo.png" alt="Ladies Fancy Store" class="brand-logo" />
        <span>
          <span class="brand-name">Ladies Fancy</span>
          <span class="brand-subtitle">Elegance Redefined</span>
        </span>
      </a>
      <button class="nav-toggle" id="navToggle" type="button" aria-expanded="false">☰ Menu</button>
      <nav class="nav-bar" id="mainNav">
        <a href="index.html">Home</a>
        <a href="products.html">Products</a>
        <a href="about.html">About</a>
        <a href="contact.html">Contact</a>
      </nav>
      <div class="header-actions">
        <a href="cart.html" class="icon-btn" aria-label="Shopping cart">
          🛒
          <span class="cart-badge hidden" id="cartBadge">0</span>
        </a>
      </div>
    </div>
  </header>

  <main>
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow">Secure Checkout</p>
        <h1>Complete your order with confidence</h1>
        <p>Enter your shipping details and payment choice to place your order securely.</p>
      </div>
    </section>

    <section class="container checkout-layout">
      <div class="checkout-card checkout-form-card">
        <div class="section-header left-align">
          <p class="eyebrow">Shipping details</p>
          <h2>Delivery information</h2>
          <p class="section-note">We securely store your details for this purchase only.</p>
        </div>

        <form class="checkout-form" novalidate>
          <div class="form-grid">
            <div class="form-group">
              <label for="fullName">Full Name</label>
              <input id="fullName" type="text" placeholder="Your full name" required />
            </div>
            <div class="form-group">
              <label for="mobileNumber">Mobile Number</label>
              <input id="mobileNumber" type="tel" placeholder="+91 98765 43210" required />
            </div>
            <div class="form-group">
              <label for="emailAddress">Email</label>
              <input id="emailAddress" type="email" placeholder="you@example.com" required />
            </div>
            <div class="form-group full-width">
              <label for="address">Address</label>
              <textarea id="address" placeholder="123 Main Street, Apartment 4B" required></textarea>
            </div>
            <div class="form-group">
              <label for="city">City</label>
              <input id="city" type="text" placeholder="Mumbai" required />
            </div>
            <div class="form-group">
              <label for="state">State</label>
              <input id="state" type="text" placeholder="Maharashtra" required />
            </div>
            <div class="form-group">
              <label for="pincode">Pincode</label>
              <input id="pincode" type="text" placeholder="400001" required />
            </div>
          </div>

          <div class="payment-panel">
            <div class="panel-heading">
              <span class="eyebrow">Payment method</span>
              <p class="section-note">Choose the option that works best for you.</p>
            </div>
            <div class="payment-grid">
              <label class="payment-option">
                <input type="radio" name="payment" value="cod" checked />
                <span>Cash on Delivery</span>
              </label>
              <label class="payment-option">
                <input type="radio" name="payment" value="upi" />
                <span>UPI</span>
              </label>
              <label class="payment-option">
                <input type="radio" name="payment" value="card" />
                <span>Credit/Debit Card</span>
              </label>
            </div>
          </div>

          <div class="checkout-actions">
            <a href="cart.html" class="btn btn-outline">Back to Cart</a>
            <button type="submit" class="btn btn-primary">Place Order</button>
          </div>
        </form>
      </div>

      <aside class="checkout-card order-summary-card">
        <div class="order-summary-header">
          <p class="eyebrow">Order summary</p>
          <h2>Review your purchase</h2>
        </div>
        <div class="secure-banner">
          <span class="secure-badge">Secure</span>
          <p>256-bit encryption protects your payment details.</p>
        </div>

        <div class="order-summary-table-wrap">
          <table class="order-summary-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Rose Gold Earrings</td>
                <td>1</td>
                <td>₹1,499</td>
              </tr>
              <tr>
                <td>Silk Handbag</td>
                <td>1</td>
                <td>₹2,299</td>
              </tr>
              <tr>
                <td>Gift Wrap</td>
                <td>1</td>
                <td>₹199</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="summary-breakdown">
          <div class="summary-row">
            <span>Subtotal</span>
            <strong>₹3,997</strong>
          </div>
          <div class="summary-row">
            <span>Shipping</span>
            <strong>Free</strong>
          </div>
          <div class="summary-row total">
            <span>Total Amount</span>
            <strong>₹3,997</strong>
          </div>
        </div>
      </aside>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <h3>Ladies Fancy Store</h3>
        <p style="color: var(--muted); line-height: 1.7;">Your destination for elegant fashion accessories and gifts.</p>
      </div>
      <div>
        <h4>Quick Links</h4>
        <a href="index.html">Home</a>
        <a href="products.html">Products</a>
        <a href="about.html">About Us</a>
        <a href="contact.html">Contact</a>
      </div>
      <div>
        <h4>Customer Care</h4>
        <a href="mailto:support@ladiesfancy.com">support@ladiesfancy.com</a>
        <a href="tel:+919876543210">+91 98765 43210</a>
      </div>
    </div>
    <div class="container footer-bottom">
      <p>&copy; 2026 Ladies Fancy Store. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>
