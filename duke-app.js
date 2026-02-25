// ==================== ADOBE DATALAYER & ALLOY HELPERS ====================

/**
 * buildPageInfo — returns the ACDL pageInfo object for the current view.
 * Mirrors the AEM/ACDL standard schema used by Launch rules.
 */
function buildPageInfo(pageName, pageType, category) {
  return {
    pageName:    pageName,
    pageType:    pageType,
    category:    category || '',
    siteSection: 'duke-apparel',
    language:    'en-IN',
    currency:    'INR',
    siteName:    'duke.com',
    server:      window.location.hostname || 'localhost',
    url:         window.location.href,
    referrer:    document.referrer || ''
  };
}

/**
 * buildProductObject — maps an internal product record to the ACDL
 * product schema (compatible with Adobe Commerce / Magento ACDL).
 */
function buildProductObject(prod, qty, position) {
  return {
    productID:      prod.id,
    productName:    prod.name,
    category:       prod.category,
    price:          prod.price,
    originalPrice:  prod.origPrice || prod.price,
    currency:       'INR',
    brand:          'Duke',
    color:          prod.colors && prod.colors[0] ? prod.colors[0].name : '',
    rating:         parseFloat(prod.rating),
    reviewCount:    prod.reviews,
    quantity:       qty || 1,
    position:       position || 0,
    inStock:        true
  };
}

/**
 * buildCartObject — full cart snapshot for checkout events.
 */
function buildCartObject() {
  const subtotal = getSubtotal();
  const gst      = Math.round(subtotal * 0.18);
  return {
    cartID:        'DUKE-CART-' + (sessionStorage.cartId || (sessionStorage.cartId = Date.now())),
    totalItems:    cart.reduce((s, i) => s + i.qty, 0),
    subtotal:      subtotal,
    tax:           gst,
    total:         subtotal + gst,
    currency:      'INR',
    products:      cart.map((item, idx) => buildProductObject(item, item.qty, idx + 1))
  };
}

/**
 * pushAdobeDataLayer — pushes a structured event into window.adobeDataLayer
 * AND fires the corresponding alloy("sendEvent") for AEP Edge Network.
 *
 * @param {string} eventName   — ACDL event name  e.g. "page:view"
 * @param {string} eventType   — XDM eventType    e.g. "web.webpagedetails.pageViews"
 * @param {object} eventData   — additional event-specific data
 * @param {object} xdmOverride — extra XDM fields to merge
 */
function pushAdobeDataLayer(eventName, eventType, eventData, xdmOverride) {
  try {
    // ── 1. Adobe Client Data Layer push ──────────────────────────────────────
    const dlPayload = {
      event:     eventName,
      eventInfo: eventData || {},
      pageContext: {
        pageName:   eventData && eventData.page ? eventData.page.pageName : '',
        pageType:   eventData && eventData.page ? eventData.page.pageType : '',
      }
    };
    window.adobeDataLayer.push(dlPayload);

    // ── 2. Adobe Web SDK — alloy("sendEvent") ────────────────────────────────
    const xdm = Object.assign({
      eventType: eventType,
      timestamp: new Date().toISOString(),
      web: {
        webPageDetails: {
          name:   dlPayload.pageContext.pageName,
          URL:    window.location.href,
          pageViews: { value: eventType === 'web.webpagedetails.pageViews' ? 1 : 0 }
        },
        webReferrer: { URL: document.referrer }
      },
      device: {
        screenWidth:  window.screen.width,
        screenHeight: window.screen.height,
        type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      }
    }, xdmOverride || {});

    alloy("sendEvent", { xdm: xdm, data: { __adobe: { duke: eventData } } });
  } catch(e) {
    try { console.log('[ACDL] pushAdobeDataLayer error:', e.message); } catch(ex) {}
  }
}

// ==================== DATA ====================
const CATEGORIES = ['Shirts','T-Shirts','Pants','Shoes','Shorts','Joggers','Accessories'];
const EMOJIS = {Shirts:'👔','T-Shirts':'👕',Pants:'👖',Shoes:'👟',Shorts:'🩲',Joggers:'🏃',Accessories:'🎒'};
const COLORS_MAP = [
  {name:'Jet Black',hex:'#1a1a1a'},
  {name:'Pure White',hex:'#f5f5f5'},
  {name:'Slate Grey',hex:'#4a5568'},
  {name:'Mocha Brown',hex:'#8B4513'},
  {name:'Forest Green',hex:'#2d5a27'},
  {name:'Rust Red',hex:'#c0392b'},
  {name:'Camel',hex:'#c8a96e'},
  {name:'Navy',hex:'#1e3a5f'},
];

const PRODUCT_NAMES = {
  Shirts: ['Oxford Classic','Linen Breeze','Chambray Essential','Poplin Slim','Flannel Weekend','Herringbone Formal','Twill Daily','Broadcloth Crisp','Dobby Luxe','Mandarin Collar'],
  'T-Shirts': ['Essential Crew','Heavyweight Tee','Slub Cotton Tee','Longline Tee','V-Neck Essential','Pocket Tee','Oversized Comfort','Half-Sleeve Modal','Ribbed Stretch','Tie-Dye Special'],
  Pants: ['Slim Chino','Cargo Utility','Linen Wide-Leg','Tapered Trouser','Relaxed Fit','Tech Jogger Pant','Pleated Classic','Drawstring Casual','Pinstripe Formal','Cropped Ankle'],
  Shoes: ['Canvas Low-Top','Leather Derby','Suede Loafer','Running Ace','Trail Hiker','Chelsea Boot','Slip-On Espadrille','High-Top Sneaker','Boat Shoe','Oxford Brogues'],
  Shorts: ['Chino Short','Athletic 5"','Linen Drawstring','Cargo Pocket','Denim Cut-Off','Swim Short','Pleated Bermuda','Running Split','Board Short','Tailored Short'],
  Joggers: ['Tech Fleece','French Terry','Tapered Slim','Wide-Leg Cozy','Zip Pocket','Lightweight Run','Ribbed Cuff','Cotton Modal','Double Knit','Travel Jogger'],
  Accessories: ['Canvas Tote','Leather Belt','Knit Beanie','Wool Scarf','Sunglasses Case','Passport Holder','Card Wallet','Watch Strap','Shoe Bag','Cap Essential'],
};

const products = {};
CATEGORIES.forEach(cat => {
  products[cat] = PRODUCT_NAMES[cat].map((name, i) => {
    const price = Math.round((599 + Math.random() * 2800) / 100) * 100;
    const hasDiscount = Math.random() > 0.5;
    const origPrice = hasDiscount ? Math.round(price * (1 + 0.1 + Math.random() * 0.3)) : null;
    const numColors = 2 + Math.floor(Math.random() * 4);
    const colors = COLORS_MAP.sort(() => Math.random() - 0.5).slice(0, numColors);
    return {
      id: `${cat.replace(/\s/g,'-')}-${i}`,
      category: cat,
      name,
      price,
      origPrice,
      colors,
      rating: (3.8 + Math.random() * 1.2).toFixed(1),
      reviews: Math.floor(40 + Math.random() * 300),
      emoji: EMOJIS[cat],
      badge: i < 2 ? (i === 0 ? 'New' : 'Bestseller') : '',
      desc: `Premium quality ${name.toLowerCase()} crafted with care. Perfect for everyday wear and special occasions alike.`,
    };
  });
});

let currentCategory = 'Shirts';
let currentProduct = null;
let cart = [];
let pdpQty = 1;

// ==================== NAVIGATION ====================
// Page-type map — used by ACDL pageInfo
const PAGE_TYPES = {
  home:     'homepage',
  plp:      'category',
  pdp:      'product',
  cart:     'cart',
  login:    'login',
  checkout: 'checkout',
  payment:  'payment',
  thankyou: 'order-confirmation'
};

function goTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  window.scrollTo(0, 0);
  if (page === 'cart')     renderCart();
  if (page === 'checkout') renderCheckoutSummary();
  if (page === 'payment')  renderPaymentSummary();

  // ── ACDL + Alloy: page view ────────────────────────────────────────────
  const pageName = 'duke:' + page;
  const pageType = PAGE_TYPES[page] || page;
  const pageInfo  = buildPageInfo(pageName, pageType);

  // Push page-view event
  pushAdobeDataLayer(
    'page:view',
    'web.webpagedetails.pageViews',
    { page: pageInfo },
    {
      web: {
        webPageDetails: {
          name:      pageName,
          URL:       window.location.href,
          pageViews: { value: 1 }
        }
      },
      commerce: (page === 'cart' || page === 'checkout' || page === 'payment')
        ? { order: { currencyCode: 'INR' } }
        : undefined
    }
  );
}

function goToPLP(cat) {
  currentCategory = cat;
  document.getElementById('plp-tag').textContent = 'Collection';
  document.getElementById('plp-title').textContent = cat;
  document.getElementById('plp-count').textContent = `${products[cat].length} Products`;
  document.getElementById('plp-breadcrumb').textContent = cat;
  renderPLP(cat);
  goTo('plp');

  // ── ACDL + Alloy: category / PLP view ─────────────────────────────────
  const productList = products[cat].map((p, idx) => buildProductObject(p, 1, idx + 1));
  pushAdobeDataLayer(
    'category:view',
    'commerce.productListViews',
    {
      page:     buildPageInfo('duke:plp:' + cat.toLowerCase(), 'category', cat),
      category: { name: cat, id: cat.toLowerCase().replace(/\s/g, '-') },
      products: productList
    },
    {
      commerce: {
        productListViews: { value: 1 },
        productListItems: productList.map(p => ({
          SKU:      p.productID,
          name:     p.productName,
          priceTotal: p.price,
          currencyCode: 'INR',
          quantity: 1
        }))
      }
    }
  );
}

function goToPDP(productId) {
  const cat = CATEGORIES.find(c => products[c].find(p => p.id === productId));
  const prod = products[cat].find(p => p.id === productId);
  if (!prod) return;
  currentProduct = prod;
  pdpQty = 1;
  document.getElementById('pdp-qty').textContent = 1;
  document.getElementById('pdp-cat-link').textContent = cat;
  document.getElementById('pdp-cat-link').onclick = () => goToPLP(cat);
  document.getElementById('pdp-name-bc').textContent = prod.name;
  document.getElementById('pdp-brand').textContent = 'Duke';
  document.getElementById('pdp-name').textContent = prod.name;
  document.getElementById('pdp-emoji').textContent = prod.emoji;
  document.getElementById('pdp-price').textContent = formatPrice(prod.price);
  const origEl = document.getElementById('pdp-price-orig');
  const discEl = document.getElementById('pdp-discount');
  if (prod.origPrice) {
    origEl.textContent = formatPrice(prod.origPrice);
    const disc = Math.round((1 - prod.price / prod.origPrice) * 100);
    discEl.textContent = `-${disc}%`;
    discEl.classList.remove('hidden');
  } else {
    origEl.textContent = '';
    discEl.classList.add('hidden');
  }
  const stars = '★'.repeat(Math.round(prod.rating)) + '☆'.repeat(5 - Math.round(prod.rating));
  document.getElementById('pdp-stars').textContent = stars;
  document.getElementById('pdp-rating-count').textContent = `(${prod.reviews} reviews)`;
  // Colors
  const colorsEl = document.getElementById('pdp-colors');
  colorsEl.innerHTML = prod.colors.map(c =>
    `<div class="pdp-color" title="${c.name}" style="background:${c.hex}" onclick="selectColor(this)"></div>`
  ).join('');
  colorsEl.firstChild && colorsEl.firstChild.classList.add('active');
  // Thumbs
  const thumbsEl = document.getElementById('pdp-thumbs');
  thumbsEl.innerHTML = ['👀','🔍','✨','📦'].map((em,i) =>
    `<div class="pdp-thumb ${i===0?'active':''}" onclick="selectThumb(this,'${prod.emoji}')">${prod.emoji}</div>`
  ).join('');
  document.getElementById('pdp-desc').textContent = prod.desc;
  goTo('pdp');

  // ── ACDL + Alloy: product detail view ─────────────────────────────────
  const productObj = buildProductObject(prod, 1, 1);
  pushAdobeDataLayer(
    'product:view',
    'commerce.productViews',
    {
      page:    buildPageInfo('duke:pdp:' + prod.id, 'product', cat),
      product: productObj
    },
    {
      commerce: {
        productViews: { value: 1 },
        productListItems: [{
          SKU:          prod.id,
          name:         prod.name,
          priceTotal:   prod.price,
          currencyCode: 'INR',
          quantity:     1
        }]
      }
    }
  );
}

function scrollToCats() {
  document.getElementById('categories-section').scrollIntoView({behavior:'smooth'});
}

// ==================== PLP RENDER ====================
function renderPLP(cat) {
  const grid = document.getElementById('product-grid');
  grid.innerHTML = products[cat].map(prod => `
    <div class="prod-card" onclick="goToPDP('${prod.id}')">
      <div class="prod-card-img" ${prod.badge ? `data-badge="${prod.badge}"` : ''}>
        <span style="font-size:64px">${prod.emoji}</span>
        <button type="button" class="prod-wishlist" onclick="event.stopPropagation()">
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>
      <p class="prod-brand">DUKE</p>
      <p class="prod-name">${prod.name}</p>
      <div class="prod-meta">
        <span class="prod-price">${formatPrice(prod.price)}${prod.origPrice ? ` <span style="font-size:12px;color:var(--muted);text-decoration:line-through;font-weight:400">${formatPrice(prod.origPrice)}</span>` : ''}</span>
        <div class="prod-colors">${prod.colors.map(c => `<div class="prod-color-dot" style="background:${c.hex}" title="${c.name}"></div>`).join('')}</div>
      </div>
      <div class="prod-rating">
        <span class="prod-stars">${'★'.repeat(Math.round(prod.rating))}</span>
        <span>${prod.rating} (${prod.reviews})</span>
      </div>
    </div>
  `).join('');
}

// ==================== FEATURED (HOME SWITCHER) ====================
function switchCat(cat) {
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  currentCategory = cat;
  renderFeatured(cat);

  // ── ACDL: homepage category tab switch ──────────────────────────────────
  pushAdobeDataLayer(
    'ui:category-tab-click',
    'web.webinteraction.linkClicks',
    {
      page:      buildPageInfo('duke:home', 'homepage'),
      component: 'category-switcher',
      category:  cat
    },
    {
      web: { webInteraction: { name: 'category-tab:' + cat, type: 'click', linkClicks: { value: 1 } } }
    }
  );
}

function renderFeatured(cat) {
  const prods = products[cat].slice(0, 4);
  document.getElementById('featured-products').innerHTML = prods.map(prod => `
    <div class="feat-card" onclick="goToPDP('${prod.id}')">
      <div class="feat-card-img">
        <span>${prod.emoji}</span>
        <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 80%,rgba(200,169,110,.08),transparent)"></div>
      </div>
      <div class="feat-card-body">
        <p class="feat-card-cat">${cat}</p>
        <p class="feat-card-name">${prod.name}</p>
        <p class="feat-card-price">${formatPrice(prod.price)}</p>
        <div class="feat-card-colors">${prod.colors.map(c => `<div class="color-dot" style="background:${c.hex}"></div>`).join('')}</div>
      </div>
    </div>
  `).join('');
}

// ==================== CART ====================
function addToCartFromPDP() {
  if (!currentProduct) return;
  const qty = pdpQty;
  const existing = cart.find(i => i.id === currentProduct.id);
  if (existing) existing.qty += qty;
  else cart.push({...currentProduct, qty});
  updateCartBadge();
  showToast(`${currentProduct.name} added to cart!`);

  // ── ACDL + Alloy: add to cart ──────────────────────────────────────────
  const productObj = buildProductObject(currentProduct, qty, 1);
  pushAdobeDataLayer(
    'cart:add',
    'commerce.productListAdds',
    {
      page:    buildPageInfo('duke:pdp:' + currentProduct.id, 'product', currentProduct.category),
      product: productObj,
      cart:    buildCartObject()
    },
    {
      commerce: {
        productListAdds: { value: 1 },
        productListItems: [{
          SKU:          currentProduct.id,
          name:         currentProduct.name,
          priceTotal:   currentProduct.price * qty,
          currencyCode: 'INR',
          quantity:     qty
        }]
      }
    }
  );
}

function addToCart(productId) {
  const cat = CATEGORIES.find(c => products[c].find(p => p.id === productId));
  const prod = products[cat].find(p => p.id === productId);
  const existing = cart.find(i => i.id === productId);
  if (existing) existing.qty++;
  else cart.push({...prod, qty: 1});
  updateCartBadge();
  showToast(`${prod.name} added to cart!`);
}

function updateCartBadge() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cart-badge').textContent = count;
}

function changeCartQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  renderCart();
  updateCartBadge();
}

function removeFromCart(id) {
  const item = cart.find(i => i.id === id);
  if (item) {
    // ── ACDL + Alloy: remove from cart ──────────────────────────────────
    pushAdobeDataLayer(
      'cart:remove',
      'commerce.productListRemovals',
      {
        page:    buildPageInfo('duke:cart', 'cart'),
        product: buildProductObject(item, item.qty, 1),
        cart:    buildCartObject()
      },
      {
        commerce: {
          productListRemovals: { value: 1 },
          productListItems: [{ SKU: item.id, name: item.name, quantity: item.qty }]
        }
      }
    );
  }
  cart = cart.filter(i => i.id !== id);
  renderCart();
  updateCartBadge();
}

function getSubtotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }

function renderCart() {
  const layout = document.getElementById('cart-layout');
  if (cart.length === 0) {
    layout.innerHTML = `<div class="cart-empty">
      <div class="cart-empty-icon">🛒</div>
      <h2>Your cart is empty</h2>
      <p>Looks like you haven't added anything yet.</p>
      <button type="button" class="btn-primary" onclick="goTo('home')">Start Shopping</button>
    </div>`;
    return;
  }
  const subtotal = getSubtotal();
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;
  layout.innerHTML = `
    <div>
      ${cart.map(item => `
        <div class="cart-item">
          <div class="cart-item-img">${item.emoji}</div>
          <div>
            <p class="cart-item-name">${item.name}</p>
            <p class="cart-item-meta">Size: M · Color: ${item.colors[0]?.name || 'Black'} · Duke</p>
            <div class="cart-item-qty">
              <button type="button" onclick="changeCartQty('${item.id}',-1)">−</button>
              <span>${item.qty}</span>
              <button type="button" onclick="changeCartQty('${item.id}',1)">+</button>
            </div>
          </div>
          <div>
            <p class="cart-item-price">${formatPrice(item.price * item.qty)}</p>
            <span class="cart-item-remove" onclick="removeFromCart('${item.id}')">Remove</span>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="cart-summary">
      <h3>Order Summary</h3>
      <div class="summary-row"><span>Subtotal (${cart.reduce((s,i)=>s+i.qty,0)} items)</span><span>${formatPrice(subtotal)}</span></div>
      <div class="summary-row"><span>Shipping</span><span>${subtotal >= 999 ? 'Free' : '₹99'}</span></div>
      <div class="summary-row"><span>GST (18%)</span><span>${formatPrice(gst)}</span></div>
      <div class="summary-row total"><span>Total</span><span>${formatPrice(total)}</span></div>
      <div class="promo-code">
        <input type="text" placeholder="Promo code">
        <button>Apply</button>
      </div>
      <button type="button" class="checkout-btn gold" onclick="goToLogin()">Proceed to Checkout →</button>
      <button type="button" class="checkout-btn" style="background:transparent;border:1.5px solid var(--border);color:var(--ink)" onclick="goTo('home')">Continue Shopping</button>
    </div>`;
}

function renderCheckoutSummary() {
  const el = document.getElementById('checkout-items');
  const subtotal = getSubtotal();
  const gst = Math.round(subtotal * 0.18);
  el.innerHTML = cart.map(item => `
    <div class="order-item-row">
      <div class="order-item-img">${item.emoji}<span class="order-item-badge">${item.qty}</span></div>
      <div><p class="order-item-name">${item.name}</p><p class="order-item-meta">Size M · ${item.colors[0]?.name||'Black'}</p></div>
      <span class="order-item-price">${formatPrice(item.price*item.qty)}</span>
    </div>`).join('');
  document.getElementById('co-subtotal').textContent = formatPrice(subtotal);
  document.getElementById('co-gst').textContent = formatPrice(gst);
  document.getElementById('co-total').textContent = formatPrice(subtotal + gst);
}

function renderPaymentSummary() {
  const el = document.getElementById('payment-items');
  const subtotal = getSubtotal();
  const gst = Math.round(subtotal * 0.18);
  el.innerHTML = cart.map(item => `
    <div class="order-item-row">
      <div class="order-item-img">${item.emoji}<span class="order-item-badge">${item.qty}</span></div>
      <div><p class="order-item-name">${item.name}</p><p class="order-item-meta">Size M</p></div>
      <span class="order-item-price">${formatPrice(item.price*item.qty)}</span>
    </div>`).join('');
  document.getElementById('pay-subtotal').textContent = formatPrice(subtotal);
  document.getElementById('pay-gst').textContent = formatPrice(gst);
  document.getElementById('pay-total').textContent = formatPrice(subtotal + gst);
}

function placeOrder() {
  const subtotal = getSubtotal();
  const gst   = Math.round(subtotal * 0.18);
  const total  = subtotal + gst;
  const name   = document.getElementById('fname')?.value || 'Friend';
  const orderNum = 'DUKE-2025-' + Math.floor(1000 + Math.random() * 9000);

  document.getElementById('ty-name').textContent      = name || 'Friend';
  document.getElementById('ty-amount').textContent    = formatPrice(total);
  document.getElementById('ty-order-num').textContent = '#' + orderNum;

  // ── ACDL + Alloy: purchase / order placed ─────────────────────────────
  const cartSnapshot = buildCartObject();
  pushAdobeDataLayer(
    'order:placed',
    'commerce.purchases',
    {
      page:    buildPageInfo('duke:thankyou', 'order-confirmation'),
      order: {
        orderID:      orderNum,
        subtotal:     subtotal,
        tax:          gst,
        total:        total,
        currency:     'INR',
        customerName: name,
        products:     cartSnapshot.products
      },
      cart: cartSnapshot
    },
    {
      commerce: {
        purchases: { value: 1 },
        order: {
          purchaseID:   orderNum,
          priceTotal:   total,
          taxAmount:    gst,
          currencyCode: 'INR'
        },
        productListItems: cart.map(item => ({
          SKU:          item.id,
          name:         item.name,
          priceTotal:   item.price * item.qty,
          currencyCode: 'INR',
          quantity:     item.qty
        }))
      }
    }
  );

  cart = [];
  updateCartBadge();
  goTo('thankyou');
}

// ==================== UI HELPERS ====================
function formatPrice(n) { return '₹' + n.toLocaleString('en-IN'); }

function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function changeQty(delta) {
  pdpQty = Math.max(1, pdpQty + delta);
  document.getElementById('pdp-qty').textContent = pdpQty;
}

function selectSize(btn) {
  if (btn.classList.contains('unavail')) return;
  btn.closest('.pdp-info, .filter-panel')?.querySelectorAll('.pdp-size').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function selectColor(dot) {
  dot.closest('.pdp-colors').querySelectorAll('.pdp-color').forEach(d => d.classList.remove('active'));
  dot.classList.add('active');
}

function selectThumb(thumb, emoji) {
  document.querySelectorAll('.pdp-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
  document.getElementById('pdp-emoji').textContent = emoji;
}

function toggleAccordion(header) {
  const acc = header.closest('.accordion');
  acc.classList.toggle('open');
}

function toggleFilter(header) {
  const opts = header.nextElementSibling;
  const chevron = header.querySelector('.filter-chevron');
  if (opts.style.display === 'none') {
    opts.style.display = '';
    chevron.classList.add('open');
  } else {
    opts.style.display = 'none';
    chevron.classList.remove('open');
  }
}

function toggleFilterOpt(label) {
  label.classList.toggle('active');
}

function toggleColorFilter(dot) {
  dot.classList.toggle('active');
}

function sortProducts(val) {
  const cat = currentCategory;
  let sorted = [...products[cat]];
  if (val === 'price-asc') sorted.sort((a,b) => a.price - b.price);
  else if (val === 'price-desc') sorted.sort((a,b) => b.price - a.price);
  else if (val === 'rating') sorted.sort((a,b) => b.rating - a.rating);
  else if (val === 'newest') sorted.reverse();
  const orig = products[cat];
  products[cat] = sorted;
  renderPLP(cat);
  products[cat] = orig;

  // ── ACDL: PLP sort interaction ───────────────────────────────────────────
  pushAdobeDataLayer(
    'plp:sort',
    'web.webinteraction.linkClicks',
    {
      page:      buildPageInfo('duke:plp:' + cat.toLowerCase(), 'category', cat),
      component: 'sort-selector',
      sortBy:    val,
      category:  cat
    },
    {
      web: { webInteraction: { name: 'plp-sort:' + val, type: 'other', linkClicks: { value: 1 } } }
    }
  );
}

function selectDelivery(label) {
  document.querySelectorAll('.delivery-opt').forEach(o => o.classList.remove('active'));
  label.classList.add('active');
  const method = label.querySelector('.delivery-opt-name')?.textContent || '';

  // ── ACDL: delivery method selection ───────────────────────────────────
  pushAdobeDataLayer(
    'checkout:delivery-method-select',
    'web.webinteraction.linkClicks',
    {
      page:           buildPageInfo('duke:checkout', 'checkout'),
      component:      'delivery-selector',
      deliveryMethod: method,
      cart:           buildCartObject()
    },
    {
      web: { webInteraction: { name: 'delivery:' + method, type: 'click', linkClicks: { value: 1 } } }
    }
  );
}

function selectPayMethod(btn, method) {
  document.querySelectorAll('.pay-method').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['card','upi','netbank','cod'].forEach(m => {
    const el = document.getElementById('pay-'+m+'-form');
    if(el) el.classList.toggle('hidden', m !== method);
  });

  // ── ACDL: payment method selection ────────────────────────────────────
  pushAdobeDataLayer(
    'checkout:payment-method-select',
    'web.webinteraction.linkClicks',
    {
      page:          buildPageInfo('duke:payment', 'payment'),
      component:     'payment-method-selector',
      paymentMethod: method,
      cart:          buildCartObject()
    },
    {
      web: { webInteraction: { name: 'payment:' + method, type: 'click', linkClicks: { value: 1 } } }
    }
  );
}

function updateCardPreview(input, field) {
  if (field === 'number') {
    let v = input.value.replace(/\D/g,'').substring(0,16);
    input.value = v.replace(/(.{4})/g,'$1 ').trim();
    document.getElementById('preview-number').textContent = (input.value || '•••• •••• •••• ••••').padEnd(19,'•').replace(/\d(?=.{1,4} )/g,'•');
  } else if (field === 'name') {
    document.getElementById('preview-name').textContent = input.value.toUpperCase() || 'YOUR NAME';
  } else if (field === 'expiry') {
    document.getElementById('preview-expiry').textContent = input.value || 'MM/YY';
  }
}

// ==================== IDENTITY STATE ====================
// Holds the authenticated user throughout the session
let currentUser = null;

/*
 * MOCK USER DATABASE
 * In production this would be your CRM / auth API response.
 * The dukeUserID is what you'd upload to AEP as CRM data
 * for identity stitching against the ECID collected on-site.
 *
 * Format mirrors what you'd export from your CRM CSV:
 *   dukeUserID, email, phone, firstName, lastName, loyaltyTier
 */
var AT = window.AT || '@'; // defined in first script tag
const MOCK_USERS = [

  // ── Platinum Tier ──────────────────────────────────────────────────────────
  { dukeUserID: 'DUKE-USR-1001', email: 'arjun' + AT + 'example.test',     phone: '+919876543210', firstName: 'Arjun',     lastName: 'Sharma',    loyaltyTier: 'Platinum', password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1002', email: 'priya' + AT + 'example.test',     phone: '+919845001234', firstName: 'Priya',     lastName: 'Nair',      loyaltyTier: 'Platinum', password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1003', email: 'raj' + AT + 'example.test',       phone: '+919000000001', firstName: 'Raj',       lastName: 'Kumar',     loyaltyTier: 'Platinum', password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1004', email: 'divya' + AT + 'example.test',     phone: '+919000000002', firstName: 'Divya',     lastName: 'Menon',     loyaltyTier: 'Platinum', password: 'duke' + AT + '2025'    },

  // ── Gold Tier ──────────────────────────────────────────────────────────────
  { dukeUserID: 'DUKE-USR-1005', email: 'sneha' + AT + 'example.test',     phone: '+917654321098', firstName: 'Sneha',     lastName: 'Iyer',      loyaltyTier: 'Gold',     password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1006', email: 'vikram' + AT + 'example.test',    phone: '+916543210987', firstName: 'Vikram',    lastName: 'Singh',     loyaltyTier: 'Gold',     password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1007', email: 'meena' + AT + 'example.test',     phone: '+919900112233', firstName: 'Meena',     lastName: 'Reddy',     loyaltyTier: 'Gold',     password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1008', email: 'karan' + AT + 'example.test',     phone: '+919811223344', firstName: 'Karan',     lastName: 'Mehta',     loyaltyTier: 'Gold',     password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1009', email: 'ananya' + AT + 'example.test',    phone: '+919722334455', firstName: 'Ananya',    lastName: 'Bose',      loyaltyTier: 'Gold',     password: 'duke' + AT + '2025'    },

  // ── Silver Tier ────────────────────────────────────────────────────────────
  { dukeUserID: 'DUKE-USR-1010', email: 'rahul' + AT + 'example.test',     phone: '+918765432109', firstName: 'Rahul',     lastName: 'Verma',     loyaltyTier: 'Silver',   password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1011', email: 'kavya' + AT + 'example.test',     phone: '+918633445566', firstName: 'Kavya',     lastName: 'Pillai',    loyaltyTier: 'Silver',   password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1012', email: 'rohit' + AT + 'example.test',     phone: '+918544556677', firstName: 'Rohit',     lastName: 'Joshi',     loyaltyTier: 'Silver',   password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1013', email: 'pooja' + AT + 'example.test',     phone: '+918455667788', firstName: 'Pooja',     lastName: 'Tiwari',    loyaltyTier: 'Silver',   password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1014', email: 'aditya' + AT + 'example.test',    phone: '+918366778899', firstName: 'Aditya',    lastName: 'Rao',       loyaltyTier: 'Silver',   password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1015', email: 'nisha' + AT + 'example.test',     phone: '+918277889900', firstName: 'Nisha',     lastName: 'Kapoor',    loyaltyTier: 'Silver',   password: 'duke' + AT + '2025'    },

  // ── Bronze Tier ────────────────────────────────────────────────────────────
  { dukeUserID: 'DUKE-USR-1016', email: 'suresh' + AT + 'example.test',    phone: '+917188990011', firstName: 'Suresh',    lastName: 'Patil',     loyaltyTier: 'Bronze',   password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1017', email: 'anita' + AT + 'example.test',     phone: '+917000000003', firstName: 'Anita',     lastName: 'Das',       loyaltyTier: 'Bronze',   password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1018', email: 'manish' + AT + 'example.test',    phone: '+917000000004', firstName: 'Manish',    lastName: 'Gupta',     loyaltyTier: 'Bronze',   password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1019', email: 'lakshmi' + AT + 'example.test',   phone: '+917000000005', firstName: 'Lakshmi',   lastName: 'Krishnan',  loyaltyTier: 'Bronze',   password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1020', email: 'deepak' + AT + 'example.test',    phone: '+917000000006', firstName: 'Deepak',    lastName: 'Malhotra',  loyaltyTier: 'Bronze',   password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1021', email: 'sunita' + AT + 'example.test',    phone: '+917000000007', firstName: 'Sunita',    lastName: 'Choudhury', loyaltyTier: 'Bronze',   password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1022', email: 'nikhil' + AT + 'example.test',    phone: '+917000000008', firstName: 'Nikhil',    lastName: 'Bansal',    loyaltyTier: 'Bronze',   password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1023', email: 'rekha' + AT + 'example.test',     phone: '+917000000009', firstName: 'Rekha',     lastName: 'Srinivas',  loyaltyTier: 'Bronze',   password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1024', email: 'tarun' + AT + 'example.test',     phone: '+917000000010', firstName: 'Tarun',     lastName: 'Saxena',    loyaltyTier: 'Bronze',   password: 'duke' + AT + '2025'    },
  { dukeUserID: 'DUKE-USR-1025', email: 'geeta' + AT + 'example.test',     phone: '+917000000011', firstName: 'Geeta',     lastName: 'Pandey',    loyaltyTier: 'Bronze',   password: 'duke' + AT + '2025'    },

];

/**
 * sha256Stub — in a real implementation use SubtleCrypto:
 *   const hash = await crypto.subtle.digest('SHA-256', encoder.encode(value))
 * For the stub we return a deterministic fake hash for demo purposes.
 */
function sha256Stub(value) {
  // In production: replace with real SHA-256 via SubtleCrypto API
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = Math.imul(31, h) + value.charCodeAt(i) | 0;
  }
  return 'sha256_stub_' + Math.abs(h).toString(16).padStart(8,'0') + value.length.toString(16);
}

// ==================== LOGIN PAGE FUNCTIONS ====================

function goToLogin() {
  // Render cart preview on the login page left panel first
  renderLoginCartPreview();
  // goTo handles page switch + fires the page:view ACDL event
  goTo('login');
}

function renderLoginCartPreview() {
  const el   = document.getElementById('login-cart-preview-items');
  const total = document.getElementById('login-cart-total');
  if (!el) return;
  el.innerHTML = cart.slice(0, 3).map(item => `
    <div class="login-cart-item-row">
      <div class="login-cart-thumb">${item.emoji}</div>
      <span class="login-cart-item-name">${item.name} × ${item.qty}</span>
      <span class="login-cart-item-price">${formatPrice(item.price * item.qty)}</span>
    </div>
  `).join('') + (cart.length > 3 ? `<p style="font-size:11px;color:rgba(255,255,255,.3);margin-top:8px">+${cart.length - 3} more item(s)</p>` : '');
  if (total) total.textContent = formatPrice(getSubtotal() + Math.round(getSubtotal() * 0.18));
}

function switchLoginTab(tab, btn) {
  document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('form-signin').classList.toggle('hidden', tab !== 'signin');
  document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');

  // ── ACDL: login tab switch ─────────────────────────────────────────────
  pushAdobeDataLayer(
    'login:tab-switch',
    'web.webinteraction.linkClicks',
    {
      page:      buildPageInfo('duke:login', 'login'),
      component: 'login-tabs',
      tab:       tab
    },
    { web: { webInteraction: { name: 'login-tab:' + tab, type: 'click', linkClicks: { value: 1 } } } }
  );
}

// ==================== SIGN IN HANDLER ====================
function handleSignIn() {
  const email    = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;
  const errEl    = document.getElementById('signin-error');
  const btn      = document.getElementById('signin-btn');

  errEl.classList.remove('show');

  if (!email || !password) {
    errEl.textContent = 'Please enter your email and password.';
    errEl.classList.add('show');
    return;
  }

  // ── ACDL: login attempt ────────────────────────────────────────────────
  pushAdobeDataLayer(
    'login:attempt',
    'web.webinteraction.linkClicks',
    {
      page:      buildPageInfo('duke:login', 'login'),
      method:    'email-password',
      emailHash: sha256Stub(email)
    },
    { web: { webInteraction: { name: 'login:attempt', type: 'click', linkClicks: { value: 1 } } } }
  );

  // Simulate async auth (500ms delay)
  btn.classList.add('loading');
  btn.querySelector('span').textContent = 'Signing in…';

  setTimeout(() => {
    const user = MOCK_USERS.find(u => u.email === email && u.password === password);
    btn.classList.remove('loading');
    btn.querySelector('span').textContent = 'Sign In & Continue';

    if (!user) {
      errEl.textContent = 'Invalid email or password. Try: arjun [at] example.test / duke[at]2025';
      errEl.classList.add('show');
      document.getElementById('signin-email').classList.add('error');

      // ── ACDL: login failed ───────────────────────────────────────────
      pushAdobeDataLayer(
        'login:failed',
        'web.webinteraction.linkClicks',
        {
          page:      buildPageInfo('duke:login', 'login'),
          method:    'email-password',
          reason:    'invalid-credentials',
          emailHash: sha256Stub(email)
        },
        { web: { webInteraction: { name: 'login:failed', type: 'other', linkClicks: { value: 0 } } } }
      );
      return;
    }

    // Successful login
    currentUser = user;
    onLoginSuccess(user, 'signin');
  }, 500);
}

// ==================== REGISTER HANDLER ====================
function handleRegister() {
  const fname    = document.getElementById('reg-fname').value.trim();
  const lname    = document.getElementById('reg-lname').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const phone    = document.getElementById('reg-phone').value.trim();

  if (!fname || !email || !password) {
    alert('Please fill in all required fields.');
    return;
  }

  // Generate a new Duke user ID (in production this comes from your backend)
  const newUserID = 'DUKE-USR-' + (2000 + Math.floor(Math.random() * 999));
  const newUser = {
    dukeUserID:   newUserID,
    email:        email,
    phone:        phone,
    firstName:    fname,
    lastName:     lname,
    loyaltyTier:  'Bronze',  // new members start at Bronze
    password:     password
  };

  currentUser = newUser;

  // ── ACDL: account created ─────────────────────────────────────────────
  pushAdobeDataLayer(
    'account:created',
    'web.webinteraction.linkClicks',
    {
      page:          buildPageInfo('duke:login', 'login'),
      method:        'email-registration',
      dukeUserID:    newUserID,
      emailHash:     sha256Stub(email),
      phoneHash:     phone ? sha256Stub(phone) : null,
      loyaltyTier:   'Bronze'
    },
    { web: { webInteraction: { name: 'account:created', type: 'click', linkClicks: { value: 1 } } } }
  );

  onLoginSuccess(newUser, 'register');
}

// ==================== GUEST CHECKOUT ====================
function handleGuestCheckout() {
  // Guest gets a transient ID — no CRM stitching possible
  const guestID = 'DUKE-GUEST-' + Date.now();
  currentUser = {
    dukeUserID:  guestID,
    email:       '',
    firstName:   'Guest',
    lastName:    '',
    loyaltyTier: 'Guest',
    isGuest:     true
  };

  // ── ACDL: guest checkout ──────────────────────────────────────────────
  pushAdobeDataLayer(
    'checkout:guest',
    'web.webinteraction.linkClicks',
    {
      page:       buildPageInfo('duke:login', 'login'),
      guestID:    guestID,
      cartTotal:  getSubtotal()
    },
    { web: { webInteraction: { name: 'checkout:guest', type: 'click', linkClicks: { value: 1 } } } }
  );

  proceedToCheckout();
}

// ==================== POST-LOGIN SUCCESS ====================
/**
 * onLoginSuccess — called after both sign-in AND registration.
 *
 * This is the critical identity stitching moment:
 *   1. We push dukeUserID + emailHash into adobeDataLayer
 *   2. We call alloy("sendEvent") with identityMap containing
 *      ECID (primary) + Email (secondary) + DukeUserID (secondary)
 *   3. AEP Identity Service links ECID ↔ Email ↔ DukeUserID
 *      → The anonymous browsing session is now stitched to the
 *        known CRM profile you'll upload separately.
 */
function onLoginSuccess(user, method) {
  const emailHash = user.email ? sha256Stub(user.email) : null;
  const phoneHash = user.phone ? sha256Stub(user.phone) : null;

  // ── ACDL: login success — THIS IS THE KEY IDENTITY STITCH PUSH ────────
  /*
   * What this push does in AEP:
   *   - "user:login" event lands in AEP with dukeUserID in the payload
   *   - Alloy's identityMap links ECID (anonymous) to dukeUserID (known)
   *   - When you upload your CRM CSV with the same dukeUserID,
   *     AEP Identity Graph stitches anonymous sessions → CRM profile
   *
   * The dukeUserID field is the BRIDGE between:
   *   Web data (ECID-based)  ←→  CRM data (dukeUserID-based)
   */
  window.adobeDataLayer.push({
    event: 'user:login',
    eventInfo: {
      method:        method,          // 'signin' | 'register'
      dukeUserID:    user.dukeUserID, // ← This is the field to map as Identity in AEP schema
      emailHash:     emailHash,
      phoneHash:     phoneHash,
      loyaltyTier:   user.loyaltyTier,
      firstName:     user.firstName,
      isGuest:       user.isGuest || false,
      authenticatedState: 'authenticated'
    },
    // Full user context snapshot — useful for Launch rules targeting authenticated users
    user: {
      dukeUserID:    user.dukeUserID,
      emailHash:     emailHash,
      phoneHash:     phoneHash,
      firstName:     user.firstName,
      lastName:      user.lastName,
      loyaltyTier:   user.loyaltyTier,
      isAuthenticated: true
    },
    page: buildPageInfo('duke:login', 'login')
  });

  // ── Alloy sendEvent with full identityMap ─────────────────────────────
  /*
   * identityMap structure for AEP:
   *   ECID        → primary=true  (auto-managed by Alloy, set here for clarity)
   *   DukeUserID  → primary=false (your CRM key — use a custom namespace in AEP)
   *   Email       → primary=false (for Journey Optimizer sends)
   *   Phone       → primary=false (for SMS channel)
   *
   * In AEP → Identities, create a custom namespace:
   *   Name: Duke User ID
   *   Symbol: DUKEID
   *   Type: Cross-device
   */
  const identityMap = {
    ECID: [{
      id:                 'alloy-managed',  // Alloy fills this automatically
      primary:            true,
      authenticatedState: 'authenticated'
    }],
    DUKEID: [{                              // Your custom AEP namespace
      id:                 user.dukeUserID, // e.g. "DUKE-USR-1001"
      primary:            false,
      authenticatedState: 'authenticated'
    }]
  };

  if (emailHash) {
    identityMap.Email = [{
      id:                 emailHash,
      primary:            false,
      authenticatedState: 'authenticated'
    }];
  }

  if (phoneHash) {
    identityMap.Phone = [{
      id:                 phoneHash,
      primary:            false,
      authenticatedState: 'authenticated'
    }];
  }

  alloy("sendEvent", {
    xdm: {
      eventType:   'user.login',
      timestamp:   new Date().toISOString(),
      identityMap: identityMap,
      _duke: {
        user: {
          dukeUserID:  user.dukeUserID,
          loyaltyTier: user.loyaltyTier,
          isGuest:     user.isGuest || false
        }
      }
    },
    data: {
      __adobe: {
        duke: {
          dukeUserID:  user.dukeUserID,
          emailHash:   emailHash,
          loginMethod: method
        }
      }
    }
  });

  // Show identity badge on login page
  const badge = document.getElementById('identity-badge');
  const badgeText = document.getElementById('identity-badge-text');
  if (badge && badgeText) {
    badgeText.textContent = `Signed in · ${user.dukeUserID} · ${user.loyaltyTier}`;
    badge.classList.remove('hidden');
  }

  // Show toast and proceed after brief delay so user sees the confirmation
  showToast(`Welcome${user.firstName ? ', ' + user.firstName : ''}! Identity stitched ✓`);
  setTimeout(() => proceedToCheckout(), 900);
}

function proceedToCheckout() {
  // Pre-fill checkout form with user data if available
  if (currentUser && !currentUser.isGuest) {
    const fnameEl = document.getElementById('fname');
    if (fnameEl && currentUser.firstName) fnameEl.value = currentUser.firstName;

    // Show identity bar on checkout page
    const bar = document.getElementById('checkout-identity-bar');
    if (bar) {
      bar.style.display = 'block';
      bar.innerHTML = `
        <div class="identity-badge" style="margin-bottom:0">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Signed in as <strong>${currentUser.firstName} ${currentUser.lastName}</strong>
          &nbsp;·&nbsp; ID: <code style="font-size:11px;background:rgba(39,174,96,.1);padding:2px 6px;border-radius:3px">${currentUser.dukeUserID}</code>
          &nbsp;·&nbsp; ${currentUser.loyaltyTier} member</span>
        </div>`;
    }
  }

  goTo('checkout');
}

// ==================== INIT ====================
window.addEventListener('scroll', () => {
  const btn = document.getElementById('scrollTop');
  btn.classList.toggle('visible', window.scrollY > 400);
});

// ==================== ACDL CHECKOUT STEP HELPERS ====================
// Called from inline onclick on checkout "Continue" button
function fireCheckoutStep(step, stepName) {
  pushAdobeDataLayer(
    'checkout:step',
    'commerce.checkouts',
    {
      page:     buildPageInfo('duke:checkout', 'checkout'),
      step:     step,
      stepName: stepName,
      cart:     buildCartObject()
    },
    {
      commerce: {
        checkouts: { value: 1 },
        order: {
          currencyCode: 'INR',
          priceTotal:   getSubtotal() + Math.round(getSubtotal() * 0.18)
        }
      }
    }
  );
}

// ==================== ACDL DEBUG PANEL ====================
// Floating console so you can see all data layer pushes without DevTools
(function() {
  const panel = document.createElement('div');
  panel.id = 'acdl-debug';
  panel.style.cssText = [
    'position:fixed','bottom:80px','right:16px','width:340px','max-height:420px',
    'background:#0d0d0d','border:1px solid #333','border-radius:6px',
    'font-family:monospace','font-size:11px','color:#e0e0e0',
    'z-index:9999','overflow:hidden','display:flex','flex-direction:column',
    'box-shadow:0 8px 32px rgba(0,0,0,.5)'
  ].join(';');

  panel.innerHTML = `
    <div style="background:#1a1a1a;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #333;gap:8px">
      <span style="color:#eb1000;font-weight:700;letter-spacing:.05em">◉ ACDL / Alloy Debug</span>
      <div style="display:flex;gap:8px">
        <span id="acdl-count" style="background:#eb1000;color:#fff;border-radius:10px;padding:1px 7px;font-size:10px">0</span>
        <button type="button" onclick="document.getElementById('acdl-debug').style.display='none'"
          style="background:none;border:none;color:#888;font-size:16px;cursor:pointer;line-height:1">×</button>
      </div>
    </div>
    <div id="acdl-log" style="overflow-y:auto;flex:1;padding:8px 0"></div>
    <div style="background:#1a1a1a;padding:6px 10px;border-top:1px solid #333;display:flex;gap:8px">
      <button type="button" onclick="document.getElementById('acdl-log').innerHTML='';acdlEventCount=0;document.getElementById('acdl-count').textContent='0'"
        style="background:#333;border:none;color:#aaa;font-size:10px;padding:4px 8px;border-radius:3px;cursor:pointer">Clear</button>
      <span style="color:#555;font-size:10px;align-self:center">Open DevTools console for full payloads</span>
    </div>`;

  document.body.appendChild(panel);

  let acdlEventCount = 0;

  // Intercept future ACDL pushes for the panel
  const origPush = window.adobeDataLayer.push.bind(window.adobeDataLayer);
  window.adobeDataLayer.push = function(payload) {
    origPush(payload);
    acdlEventCount++;
    document.getElementById('acdl-count').textContent = acdlEventCount;
    const log = document.getElementById('acdl-log');
    const entry = document.createElement('div');
    entry.style.cssText = 'padding:6px 12px;border-bottom:1px solid #1a1a1a;cursor:pointer;transition:background .15s';
    entry.onmouseenter = () => entry.style.background = '#1c1c1c';
    entry.onmouseleave = () => entry.style.background = '';

    const time = new Date().toLocaleTimeString();
    const eventName = payload.event || payload['@type'] || 'state';
    const color = payload.event && payload.event.startsWith('order') ? '#27ae60'
                : payload.event && payload.event.startsWith('cart')  ? '#c8a96e'
                : payload.event && payload.event.startsWith('product')? '#74b9ff'
                : payload.event && payload.event.startsWith('page')   ? '#a29bfe'
                : payload.event && (payload.event.startsWith('user') || payload.event.startsWith('login') || payload.event.startsWith('account')) ? '#fd79a8'
                : '#dfe6e9';

    entry.innerHTML = `<span style="color:#555">${time}</span> <span style="color:${color};font-weight:700">${eventName}</span>`;
    entry.title = JSON.stringify(payload, null, 2);
    log.insertBefore(entry, log.firstChild);
  };
})();

// Init
// Scroll to top visibility
addEventListener('scroll', () => {
  const btn = document.getElementById('scrollTop');
  if (btn) btn.classList.toggle('visible', window.scrollY > 400);
});

renderFeatured('Shirts');
goTo('home');
