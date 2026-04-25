// scanner.js — Escáner funcional para GitHub Pages
import { state, showToast } from './utils.js';

let stream = null, mode = 'sell', scanning = false;
let gun = '', gunTimer = null;

// ── CARGAR ZXING ──
async function loadZXing() {
  if(window.ZXing) return window.ZXing;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@zxing/library@0.18.6/umd/index.min.js';
    s.onload  = () => resolve(window.ZXing);
    s.onerror = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/zxing-js/0.20.0/zxing.min.js';
      s2.onload  = () => resolve(window.ZXing);
      s2.onerror = reject;
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  });
}

export async function openScanner(m = 'sell') {
  mode = m;
  scanning = false;
  const statusEl = document.getElementById('scan-status');
  const manualEl = document.getElementById('scan-manual');
  if(manualEl) manualEl.value = '';
  if(statusEl) statusEl.textContent = 'Iniciando cámara...';
  document.getElementById('modal-scanner')?.classList.add('open');

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    const video = document.getElementById('scan-video');
    if(!video) return;
    video.srcObject = stream;
    await video.play();
    if(statusEl) statusEl.textContent = 'Apunta al código de barras';

    const ZXing = await loadZXing();
    const hints = new Map([
      [ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.QR_CODE,
      ]],
      [ZXing.DecodeHintType.TRY_HARDER, true],
    ]);

    const reader = new ZXing.BrowserMultiFormatReader(hints);
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    scanning = true;

    const tick = async () => {
      if(!scanning || !video.readyState || video.readyState < 2) {
        if(scanning) requestAnimationFrame(tick);
        return;
      }
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0);
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Usar luminanceSource para decodificar
        const luma = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
        const bmp  = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luma));
        const result = reader.decode(bmp);
        if(result) {
          scanning = false;
          const code = result.getText();
          if(statusEl) statusEl.textContent = "✓ " + code;
          setTimeout(() => { processBarcode(code); closeScanner(); }, 300);
          return;
        }
      } catch(e) { /* NotFoundException = normal */ }
      if(scanning) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);

  } catch(e) {
    console.error(e);
    if(statusEl) statusEl.textContent = 'Cámara no disponible — usa el campo o pistola lectora ↓';
  }
}

export function closeScanner() {
  scanning = false;
  if(stream){ stream.getTracks().forEach(t=>{ t.stop(); t.enabled=false; }); stream=null; }
  const v = document.getElementById('scan-video');
  if(v){ v.pause(); v.srcObject=null; }
  document.getElementById('modal-scanner')?.classList.remove('open');
}

export function processBarcode(code) {
  const c = code.trim(); if(!c) return;
  if(mode === 'sell') {
    const p = state.products.find(x => x.ean === c);
    if(p){ window.addToSale?.(p.id,1); showToast("✓ " + p.name + " agregado"); }
    else showToast("Código " + c + " no registrado", 'err');
  } else if(mode === 'entry') {
    const p = state.products.find(x => x.ean === c);
    if(p){ window._entryProduct?.(p.id); showToast("✓ " + p.name); closeScanner(); }
    else showToast("Código " + c + " no registrado", 'err');
  } else if(mode === 'toma') {
    window._tomaBarcode?.(c);
  } else if(mode === 'product') {
    const el = document.getElementById('pm-ean');
    if(el){ el.value=c; showToast('✓ Código capturado'); closeScanner(); setTimeout(()=>window.lookupEAN?.(),400); }
  }
}

export function initGun() {
  document.addEventListener('keydown', e => {
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
    if(document.getElementById('modal-scanner')?.classList.contains('open')) return;
    if(e.key==='Enter'&&gun.length>3){ processBarcode(gun); gun=''; return; }
    if(e.key.length===1&&!e.ctrlKey&&!e.altKey&&!e.metaKey){
      gun+=e.key; clearTimeout(gunTimer); gunTimer=setTimeout(()=>{gun='';},100);
    }
  });
}

window.processManualScan = function() {
  const v = document.getElementById('scan-manual')?.value.trim();
  if(!v) return;
  processBarcode(v);
  if(mode==='sell'||mode==='entry') closeScanner();
};
window.closeScanner = closeScanner;
window.openScanner  = openScanner;
