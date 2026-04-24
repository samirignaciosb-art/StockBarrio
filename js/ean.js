// ean.js — EAN lookup: local inventory → Firestore cache → Open Food Facts
import { state, showToast, eanEmoji } from './utils.js';
import { lookupEANCache, saveEANCache } from './data.js';

export async function lookupEAN() {
  const ean = document.getElementById('pm-ean')?.value.trim();
  if(!ean || ean.length < 8) return;

  const hint = document.getElementById('ean-hint');
  if(!hint) return;

  // 1. Ya en inventario local
  const local = state.products.find(p => p.ean === ean);
  if(local) {
    setHint(`Ya está en tu inventario: ${local.name}`, 'ok');
    return;
  }

  // 2. Caché global Firestore (productos de otros negocios StockBarrio)
  setHint('Buscando...', 'loading');
  const cached = await lookupEANCache(ean);
  if(cached) {
    fillForm(cached.name, cached.emoji||'📦');
    setHint(`✓ Base StockBarrio: ${cached.name}`, 'ok');
    return;
  }

  // 3. Open Food Facts (gratuito, sin API key)
  try {
    const res  = await fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}.json`);
    const data = await res.json();

    if(data.status === 1 && data.product) {
      const p     = data.product;
      const name  = p.product_name_es || p.product_name || p.generic_name || '';
      const brand = p.brands || '';
      const qty   = p.quantity || '';
      const full  = [brand, name, qty].filter(Boolean).join(' ').trim();
      const emoji = eanEmoji(p.categories_tags || []);

      if(full) {
        fillForm(full, emoji);
        setHint(`✓ Open Food Facts: ${full}`, 'ok');
        // Guardar en caché global para otros negocios
        saveEANCache(ean, {name:full, emoji});
      } else {
        setHint('No encontrado — ingresa el nombre manualmente', 'warn');
      }
    } else {
      setHint('No encontrado — ingresa el nombre manualmente', 'warn');
    }
  } catch(e) {
    setHint('Sin conexión para buscar — ingresa el nombre manualmente', 'warn');
  }
}

function fillForm(name, emoji) {
  const n = document.getElementById('pm-name');
  const e = document.getElementById('pm-emoji-hidden'); // hidden field
  if(n && !n.value) n.value = name;
  // Store emoji in state for save
  window._pendingEmoji = emoji;
}

function setHint(msg, type) {
  const h = document.getElementById('ean-hint');
  if(!h) return;
  h.textContent  = msg;
  h.style.display = 'block';
  const colors = {ok:'var(--acc)', warn:'var(--warn)', loading:'var(--text2)', err:'var(--red)'};
  h.style.color = colors[type] || 'var(--text2)';
}

window.lookupEAN = lookupEAN;
