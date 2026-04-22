// ════════════════════════════════════════
// scanner.js — Cámara y pistola lectora HID
// ════════════════════════════════════════

import { state, showToast } from './utils.js';
import { addToCart } from './sales.js';

let scannerStream = null;
let scannerMode   = 'sell'; // 'sell' | 'product'
let gunBuffer     = '';
let gunTimer      = null;

// ── ABRIR ESCÁNER ──
export async function openScanner(mode = 'sell') {
  scannerMode = mode;
  document.getElementById('scan-manual').value = '';
  document.getElementById('scan-status').textContent = 'Iniciando cámara...';
  document.getElementById('modal-scanner').classList.add('open');

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    const v = document.getElementById('scan-video');
    v.srcObject = scannerStream;
    await v.play();
    document.getElementById('scan-status').textContent = 'Apunta al código de barras';
  } catch(e) {
    document.getElementById('scan-status').textContent = 'Cámara no disponible — usa el campo o pistola lectora ↓';
  }
}

// ── CERRAR ESCÁNER ──
export function closeScanner() {
  if (scannerStream) {
    scannerStream.getTracks().forEach(t => { t.stop(); t.enabled = false; });
    scannerStream = null;
  }
  const v = document.getElementById('scan-video');
  if (v) { v.pause(); v.srcObject = null; }
  document.getElementById('modal-scanner')?.classList.remove('open');
}

// ── PROCESAR CÓDIGO ──
export function processBarcode(code) {
  const trimmed = code.trim();
  if (!trimmed) return;

  if (scannerMode === 'sell') {
    const p = state.products.find(x => x.ean === trimmed);
    if (p) {
      // Importar dinámicamente para evitar circular
      import('./sales.js').then(m => {
        window.addToCart(p.id);
        showToast(`✓ ${p.name} agregado`);
      });
    } else {
      showToast(`Código ${trimmed} no registrado`, 'err');
    }
  } else if (scannerMode === 'product') {
    const input = document.getElementById('pm-ean');
    if (input) input.value = trimmed;
    showToast('✓ Código capturado');
    closeScanner();
  }
}

// ── PROCESAR CAMPO MANUAL ──
window.processManualScan = function() {
  const val = document.getElementById('scan-manual')?.value.trim();
  if (!val) return;
  processBarcode(val);
  if (scannerMode === 'sell') closeScanner();
};

window.closeScanner = closeScanner;

// ── PISTOLA LECTORA HID (teclado rápido) ──
export function initGunReader() {
  document.addEventListener('keydown', e => {
    // Ignorar si hay un input activo (excepto si es la pistola)
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    if (document.getElementById('modal-scanner')?.classList.contains('open')) return;

    if (e.key === 'Enter' && gunBuffer.length > 3) {
      processBarcode(gunBuffer);
      gunBuffer = '';
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      gunBuffer += e.key;
      clearTimeout(gunTimer);
      // La pistola envía caracteres en <50ms — si pasa más tiempo, es teclado humano
      gunTimer = setTimeout(() => { gunBuffer = ''; }, 120);
    }
  });

  // También capturar en el campo manual del escáner con Enter
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('scan-manual')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') window.processManualScan();
    });
  });
}
