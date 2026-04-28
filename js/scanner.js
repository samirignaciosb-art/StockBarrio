// scanner.js — Escáner optimizado (ZXing correcto + UX pro)
import { state, showToast } from './utils.js';

let stream = null;
let mode = 'sell';
let scanning = false;
let gun = '';
let gunTimer = null;
let codeReader = null;
let lastScan = null;

// ── CARGAR ZXING ──
async function loadZXing() {
  if (window.ZXing) return window.ZXing;

  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@zxing/library@0.18.6/umd/index.min.js';

    s.onload = () => resolve(window.ZXing);

    s.onerror = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/zxing-js/0.20.0/zxing.min.js';
      s2.onload = () => resolve(window.ZXing);
      s2.onerror = reject;
      document.head.appendChild(s2);
    };

    document.head.appendChild(s);
  });
}

// ── ABRIR ESCÁNER ──
export async function openScanner(m = 'sell') {
  mode = m;
  scanning = false;
  lastScan = null;

  const statusEl = document.getElementById('scan-status');
  const manualEl = document.getElementById('scan-manual');
  const video    = document.getElementById('scan-video');

  if (manualEl) manualEl.value = '';
  if (statusEl) statusEl.textContent = 'Iniciando cámara...';

  document.getElementById('modal-scanner')?.classList.add('open');

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    if (!video) return;
    video.srcObject = stream;
    await video.play();

    if (statusEl) statusEl.textContent = 'Apunta al código';

    const ZXing = await loadZXing();

    // Solo formatos de almacén → mejor rendimiento
    const hints = new Map([
      [ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.EAN_13,
        ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.UPC_A
      ]],
      [ZXing.DecodeHintType.TRY_HARDER, true]
    ]);

    codeReader = new ZXing.BrowserMultiFormatReader(hints);
    scanning = true;

    // Lectura continua real — este es el fix clave
    codeReader.decodeFromVideoDevice(null, video, (result, err) => {
      if (!scanning) return;

      if (result) {
        const code = result.getText();

        // Anti-duplicados
        if (code === lastScan) return;
        lastScan = code;

        scanning = false;
        if (statusEl) statusEl.textContent = '✓ ' + code;

        // Feedback físico en móvil
        navigator.vibrate?.(100);

        setTimeout(() => {
          processBarcode(code);
          closeScanner();
        }, 200);
      }

      if (err && !(err instanceof ZXing.NotFoundException)) {
        console.error(err);
      }
    });

  } catch (e) {
    console.error(e);
    if (statusEl) {
      statusEl.textContent = 'Cámara no disponible — usa pistola o ingreso manual ↓';
    }
  }
}

// ── CERRAR ESCÁNER ──
export function closeScanner() {
  scanning = false;
  lastScan = null;

  if (codeReader) { codeReader.reset(); codeReader = null; }

  if (stream) {
    stream.getTracks().forEach(t => { t.stop(); t.enabled = false; });
    stream = null;
  }

  const v = document.getElementById('scan-video');
  if (v) { v.pause(); v.srcObject = null; }

  document.getElementById('modal-scanner')?.classList.remove('open');
}

// ── PROCESAR CÓDIGO ──
export function processBarcode(code) {
  const c = code.trim();
  if (!c) return;

  if (mode === 'sell') {
    const p = state.products.find(x => x.ean === c);
    if (p) { window.addToSale?.(p.id, 1); showToast('✓ ' + p.name + ' agregado'); }
    else showToast('Código ' + c + ' no registrado', 'err');

  } else if (mode === 'entry') {
    const p = state.products.find(x => x.ean === c);
    if (p) { window._entryProduct?.(p.id); showToast('✓ ' + p.name); closeScanner(); }
    else showToast('Código ' + c + ' no registrado', 'err');

  } else if (mode === 'toma') {
    window._tomaBarcode?.(c);

  } else if (mode === 'product') {
    const el = document.getElementById('pm-ean');
    if (el) {
      el.value = c;
      showToast('✓ Código capturado');
      closeScanner();
      setTimeout(() => window.lookupEAN?.(), 400);
    }
  }
}

// ── PISTOLA LECTORA HID ──
export function initGun() {
  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
    if (document.getElementById('modal-scanner')?.classList.contains('open')) return;

    if (e.key === 'Enter' && gun.length > 3) {
      processBarcode(gun);
      gun = '';
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      gun += e.key;
      clearTimeout(gunTimer);
      gunTimer = setTimeout(() => { gun = ''; }, 100);
    }
  });
}

// ── INPUT MANUAL ──
window.processManualScan = function() {
  const v = document.getElementById('scan-manual')?.value.trim();
  if (!v) return;
  processBarcode(v);
  if (mode === 'sell' || mode === 'entry') closeScanner();
};

window.closeScanner = closeScanner;
window.openScanner  = openScanner;
