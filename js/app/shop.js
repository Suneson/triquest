// shop.js — Shopify Storefront API client for the ss-26 collection.
import { esc } from './ui.js';

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
    <div id="shop-grid" class="shop-grid"><p class="muted">Loading products…</p></div>`;
}

export async function loadShop() {
  const grid = document.getElementById('shop-grid');
  if (!grid) return;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN },
      body: JSON.stringify({ query: QUERY }),
    });
    const json = await res.json();
    const items = (json?.data?.collectionByHandle?.products?.edges || []).map((e) => e.node);
    grid.innerHTML = items.length ? items.map(card).join('') : '<p class="muted">No products found.</p>';
  } catch (e) {
    grid.innerHTML = '<p class="muted">Couldn’t load the shop. Check your connection.</p>';
  }
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
