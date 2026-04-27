// scanner.js — ZXing barcode decode + pistola lectora HID
import { state, showToast } from './utils.js';

let stream=null, mode='sell', scanning=false, codeReader=null;
let gun='', gunTimer=null;

async function loadZXing() {
  if(window.ZXing) return window.ZXing;
  return new Promise((res,rej) => {
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/zxing-js/0.20.0/zxing.min.js';
    s.onload=()=>res(window.ZXing); s.onerror=rej;
    document.head.appendChild(s);
  });
}

export async function openScanner(m='sell') {
  mode=m; scanning=false;
  document.getElementById('scan-manual').value='';
  setScanStatus('Iniciando cámara...');
  document.getElementById('modal-scanner').classList.add('open');
  try {
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}}});
    const v=document.getElementById('scan-video');
    v.srcObject=stream; await v.play();
    setScanStatus('Apunta al código de barras');
    const ZXing = await loadZXing();
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS,[
      ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39,
      ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.QR_CODE,
    ]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    codeReader = new ZXing.BrowserMultiFormatReader(hints);
    scanning = true;
    decodeLoop(v);
  } catch(e) {
    setScanStatus('Cámara no disponible — usa el campo o pistola lectora ↓');
  }
}

async function decodeLoop(video) {
  if(!scanning||!codeReader) return;
  try {
    const result = await codeReader.decodeFromVideoElement(video);
    if(result && scanning) {
      scanning=false;
      const code=result.getText();
      setScanStatus('✓ '+code);
      setTimeout(()=>{ processBarcode(code); closeScanner(); }, 300);
      return;
    }
  } catch(e) { /* NotFoundException = normal, sin código visible */ }
  if(scanning) requestAnimationFrame(()=>decodeLoop(video));
}

export function closeScanner() {
  scanning=false;
  if(codeReader){ try{codeReader.reset();}catch(e){} codeReader=null; }
  if(stream){ stream.getTracks().forEach(t=>{t.stop();t.enabled=false;}); stream=null; }
  const v=document.getElementById('scan-video');
  if(v){ v.pause(); v.srcObject=null; }
  document.getElementById('modal-scanner')?.classList.remove('open');
}

export function processBarcode(code) {
  const c=code.trim(); if(!c) return;
  if(mode==='sell') {
    const p=state.products.find(x=>x.ean===c);
    if(p){ window.addToSale?.(p.id,1); showToast(`✓ ${p.name}`); }
    else showToast(`Código ${c} no registrado`,'err');
  } else if(mode==='entry') {
    const p=state.products.find(x=>x.ean===c);
    if(p){ window._entryProduct?.(p.id); showToast(`✓ ${p.name}`); closeScanner(); }
    else showToast(`Código ${c} no registrado`,'err');
  } else if(mode==='toma') {
    window._tomaBarcode?.(c);
  } else if(mode==='product') {
    const el=document.getElementById('pm-ean');
    if(el){ el.value=c; showToast('✓ Código capturado — buscando...'); closeScanner(); setTimeout(()=>window.lookupEAN?.(),400); }
  }
}

function setScanStatus(msg) {
  const el=document.getElementById('scan-status');
  if(el) el.textContent=msg;
}

// ── PISTOLA LECTORA HID ──
export function initGun() {
  document.addEventListener('keydown', e=>{
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
    if(document.getElementById('modal-scanner')?.classList.contains('open')) return;
    if(e.key==='Enter'&&gun.length>3){ processBarcode(gun); gun=''; return; }
    if(e.key.length===1&&!e.ctrlKey&&!e.altKey){ gun+=e.key; clearTimeout(gunTimer); gunTimer=setTimeout(()=>{gun='';},120); }
  });
}

window.processManualScan = function() {
  const v=document.getElementById('scan-manual')?.value.trim();
  if(!v) return;
  processBarcode(v);
  if(mode==='sell'||mode==='entry') closeScanner();
};
window.closeScanner = closeScanner;
window.openScanner  = openScanner;
