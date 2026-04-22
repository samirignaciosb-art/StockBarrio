// scanner.js
import { state, showToast, closeModal } from './utils.js';

let stream=null, mode='sell';
let gun='', gunTimer=null;

export async function openScanner(m='sell') {
  mode=m;
  document.getElementById('scan-manual').value='';
  document.getElementById('scan-status').textContent='Iniciando cámara...';
  document.getElementById('modal-scanner').classList.add('open');
  try {
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    const v=document.getElementById('scan-video'); v.srcObject=stream; await v.play();
    document.getElementById('scan-status').textContent='Apunta al código de barras';
  } catch(e) {
    document.getElementById('scan-status').textContent='Cámara no disponible — usa el campo manual ↓';
  }
}

export function closeScanner() {
  if(stream){stream.getTracks().forEach(t=>{t.stop();t.enabled=false;});stream=null;}
  const v=document.getElementById('scan-video'); if(v){v.pause();v.srcObject=null;}
  document.getElementById('modal-scanner')?.classList.remove('open');
}

export function processBarcode(code) {
  const c=code.trim(); if(!c)return;
  if(mode==='sell') {
    const p=state.products.find(x=>x.ean===c);
    if(p){window.addToSale?window.addToSale(p.id,1):showToast(`✓ ${p.name}`,'ok');}
    else showToast(`Código ${c} no registrado`,'err');
  } else {
    const el=document.getElementById('pm-ean'); if(el){el.value=c;showToast('✓ Código capturado');closeScanner();}
  }
}

export function initGun() {
  document.addEventListener('keydown', e=>{
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
    if(document.getElementById('modal-scanner')?.classList.contains('open'))return;
    if(e.key==='Enter'&&gun.length>3){processBarcode(gun);gun='';return;}
    if(e.key.length===1&&!e.ctrlKey&&!e.altKey){gun+=e.key;clearTimeout(gunTimer);gunTimer=setTimeout(()=>{gun='';},120);}
  });
  document.getElementById('scan-manual')?.addEventListener('keydown',e=>{if(e.key==='Enter')window.processManualScan();});
}

window.processManualScan = function() {
  const v=document.getElementById('scan-manual')?.value.trim(); if(!v)return;
  processBarcode(v); if(mode==='sell')closeScanner();
};
window.closeScanner = closeScanner;
