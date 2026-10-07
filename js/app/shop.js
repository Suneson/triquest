// shop.js — Shopify Storefront API client for the ss-26 collection.
import { esc, dialogue } from './ui.js';
import { isDemo, demoShop } from './demo.js';

const ENDPOINT = 'https://moskeshop.com/api/2026-04/graphql.json';
const TOKEN = 'f42b47288ec62ce928ff8dccf9e36ffb';
const QUERY = `query {
  collectionByHandle(handle: "ss-26") {
    products(first: 40) {
      edges { node {
        title handle onlineStoreUrl
        featuredImage { url altText }
        priceRange { minVariantPrice { amount currencyCode } }
      } }
    }
  }
}`;

export function shopShell() {
  return `<div class="day-header"><h2>Shop</h2></div>
    <div id="shop-grid" class="shop-grid" aria-busy="true"><span class="sr">Loading products…</span>${skeletonCards()}</div>`;
}

// Loading tiles shaped like product cards: square image, title, price.
function skeletonCards(n = 4) {
  return Array.from({ length: n }, (_, i) => `<div class="shop-card is-sk" aria-hidden="true" style="--sk-i:${i}">
    <div class="shop-noimg sk-tile"></div>
    <div class="shop-info">
      <div class="shop-title"><i class="sk-line" style="width:${[80, 64, 72, 58][i % 4]}%"></i><br><i class="sk-line" style="width:${[46, 52, 38, 44][i % 4]}%"></i></div>
      <div class="shop-price"><i class="sk-line" style="width:40%"></i></div>
    </div>
  </div>`).join('');
}

export async function loadShop() {
  const grid = document.getElementById('shop-grid');
  if (!grid) return;
  if (isDemo()) { grid.innerHTML = demoShop().map(card).join(''); grid.removeAttribute('aria-busy'); return; }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN },
      body: JSON.stringify({ query: QUERY }),
    });
    const json = await res.json();
    const items = (json?.data?.collectionByHandle?.products?.edges || []).map((e) => e.node);
    grid.innerHTML = items.length ? items.map(card).join('') : dialogue({ who: 'Shop', icon: 'shop', text: 'No products in this drop yet.', cls: 'empty-dlg' });
  } catch (e) {
    grid.innerHTML = dialogue({ who: 'Shop', icon: 'shop', text: 'Couldn’t load the shop. Check your connection and try again.', cls: 'empty-dlg' });
  }
  grid.removeAttribute('aria-busy');
}

function price(p) {
  const m = p?.minVariantPrice;
  return m ? `${Number(m.amount).toFixed(2)} ${m.currencyCode}` : '';
}

function card(n) {
  const url = n.onlineStoreUrl || `https://moskeshop.com/products/${n.handle}`;
  const img = n.featuredImage?.url;
  return `<button class="shop-card" data-action="shop-open" data-url="${esc(url)}">
    ${img ? `<img src="${esc(img)}" alt="${esc(n.featuredImage?.altText || n.title)}" loading="lazy">` : '<div class="shop-noimg"></div>'}
    <div class="shop-info">
      <div class="shop-title">${esc(n.title)}</div>
      <div class="shop-price">${esc(price(n.priceRange))}</div>
    </div>
  </button>`;
}
