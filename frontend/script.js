const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000';
const ITEMS_ENDPOINT = API_BASE_URL + '/api/items';

let allItems = [];
let activeCategory = 'all';

const itemsContainer = document.getElementById('items-container');
const itemCountEl = document.getElementById('item-count');
const refreshBtn = document.getElementById('refresh-btn');
const filtersEl = document.getElementById('filters');
const lastSyncEl = document.getElementById('last-sync');

function drawBarcode() {
  const bar = document.getElementById('barcode');
  const widths = [2,1,3,1,2,4,1,2,1,3,2,1,4,1,2,3,1,2,1,3,2,4,1,2];
  bar.innerHTML = widths.map(w =>
    `<span style="width:${w}px;height:${8 + (w * 5)}px;"></span>`
  ).join('');
}

function formatPrice(value) {
  if (value === null || value === undefined) return 'N/D';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(value);
}

function renderFilters() {
  const categories = ['all', ...new Set(allItems.map(i => i.category).filter(Boolean))];
  filtersEl.innerHTML = categories.map(cat => `
    <button class="filter-chip ${cat === activeCategory ? 'active' : ''}" data-cat="${cat}" type="button">
      ${cat === 'all' ? 'Todos' : cat}
    </button>
  `).join('');

  filtersEl.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      renderFilters();
      renderItems();
    });
  });
}

function renderItems() {
  const filtered = activeCategory === 'all'
    ? allItems
    : allItems.filter(i => i.category === activeCategory);

  itemCountEl.textContent = filtered.length;

  if (filtered.length === 0) {
    itemsContainer.innerHTML = '<p class="state-msg">No hay registros para mostrar todavía. Corre el scraper y vuelve a reimprimir.</p>';
    return;
  }

  itemsContainer.innerHTML = filtered.map(item => `
    <div class="item-row">
      <div>
        <p class="item-title">${item.title ?? 'Sin título'}</p>
        <span class="item-meta">${item.category ?? '—'}${item.brand ? ' &middot; ' + item.brand : ''}</span>
      </div>
      <span class="item-price">${formatPrice(item.price)}</span>
      ${item.link ? `<a class="item-link" href="${item.link}" target="_blank" rel="noopener">Ver producto &rarr;</a>` : ''}
    </div>
  `).join('');
}

async function loadItems() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Cargando...';

  try {
    const res = await fetch(ITEMS_ENDPOINT);
    if (!res.ok) throw new Error('Respuesta no OK: ' + res.status);
    const data = await res.json();
    allItems = data.items ?? [];
    renderFilters();
    renderItems();
    lastSyncEl.textContent = 'Última sincronización: ' + new Date().toLocaleTimeString('es-CO');
  } catch (err) {
    itemsContainer.innerHTML = `<p class="state-msg">No se pudo conectar con la API en ${API_BASE_URL}. Verifica que server.js esté corriendo.</p>`;
    console.error(err);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Reimprimir';
  }
}

refreshBtn.addEventListener('click', loadItems);

drawBarcode();
loadItems();