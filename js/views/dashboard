// views/dashboard.js
import { state, fmt, toDate } from '../utils.js';

export function renderDashboard(c) {
  c.innerHTML = `<div id="dash-root" style="animation:fadeIn .3s ease"></div>`;
  build(); rebuild();
}

function rebuild() {
  window.addEventListener('products-updated', build);
  window.addEventListener('sales-updated', build);
  document.getElementById('dash-root')?._cleanup?.();
  document.getElementById('dash-root')._cleanup = () => {
    window.removeEventListener('products-updated', build);
    window.removeEventListener('sales-updated', build);
  };
}

function build() {
  const el=document.getElementById('dash-root'); if(!el) return;
  const now=new Date(), today=now.toLocaleDateString('es-CL');

  // Rangos
  const wkStart=new Date(now); wkStart.setDate(now.getDate()-((now.getDay()+6)%7)); wkStart.setHours(0,0,0,0);
  const pwkStart=new Date(wkStart); pwkStart.setDate(wkStart.getDate()-7);
  const m30=new Date(now); m30.setDate(now.getDate()-30);

  const todaySales = state.sales.filter(s=>toDate(s.createdAt).toLocaleDateString('es-CL')===today);
  const wkSales    = state.sales.filter(s=>toDate(s.createdAt)>=wkStart);
  const pwkSales   = state.sales.filter(s=>{ const d=toDate(s.createdAt); return d>=pwkStart&&d<wkStart; });
  const m30Sales   = state.sales.filter(s=>toDate(s.createdAt)>=m30);

  const income   = todaySales.reduce((s,x)=>s+x.total,0);
  const cost     = todaySales.reduce((s,x)=>s+x.cost,0);
  const profit   = income-cost;
  const margin   = income>0?Math.round((profit/income)*100):0;
  const invested = state.products.reduce((s,p)=>s+p.cost*p.stock,0);
  const wkInc    = wkSales.reduce((s,x)=>s+x.total,0);
  const pwkInc   = pwkSales.reduce((s,x)=>s+x.total,0);
  const wkDiff   = pwkInc>0?Math.round(((wkInc-pwkInc)/pwkInc)*100):null;
  const criticals= state.products.filter(p=>p.stock<=p.minStock).length;

  // Rotación
  const rot={};
  m30Sales.forEach(s=>(s.items||[]).forEach(i=>{rot[i.name]=(rot[i.name]||0)+i.qty;}));
  const top5  = Object.entries(rot).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxQty= top5[0]?.[1]||1;
  const soldSet= new Set(Object.keys(rot));
  const dead  = state.products.filter(p=>p.stock>0&&!soldSet.has(p.name));

  // Alertas
  const alerts=[...state.products.filter(p=>p.stock===0),...state.products.filter(p=>p.stock>0&&p.stock<=p.minStock)].slice(0,4);

  el.innerHTML=`
    <!-- KPIs - grandes en móvil -->
    <div class="kpi-row">
      <div class="kpi-card green">
        <div class="kpi-icon">💰</div>
        <div class="kpi-label">Ingresos hoy</div>
        <div class="kpi-value green">${fmt(income)}</div>
        <div class="kpi-sub">${todaySales.length} venta${todaySales.length!==1?'s':''} · ganancia ${fmt(profit)} (${margin}%)</div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-icon">📅</div>
        <div class="kpi-label">Esta semana</div>
        <div class="kpi-value blue">${fmt(wkInc)}</div>
        <div class="kpi-sub">${wkDiff!==null?`<span style="color:${wkDiff>=0?'var(--acc)':'var(--red)'}">${wkDiff>=0?'▲':'▼'} ${Math.abs(wkDiff)}%</span> vs sem. ant.`:'primera semana'}</div>
      </div>
      <div class="kpi-card warn">
        <div class="kpi-icon">🏪</div>
        <div class="kpi-label">Capital en stock</div>
        <div class="kpi-value warn">${fmt(invested)}</div>
        <div class="kpi-sub">${state.products.length} productos activos</div>
      </div>
      <div class="kpi-card ${criticals>0?'red':'green'}">
        <div class="kpi-icon">${criticals>0?'🚨':'✅'}</div>
        <div class="kpi-label">Alertas stock</div>
        <div class="kpi-value ${criticals>0?'red':'green'}">${criticals}</div>
        <div class="kpi-sub">${criticals>0?`<button onclick="navigate('alertas')" class="btn-link">Ver alertas →</button>`:'todo en orden'}</div>
      </div>
    </div>

    <div class="dash-grid">
      <div style="display:flex;flex-direction:column;gap:1rem">

        <!-- Top productos -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🔥 Más vendidos — 30 días</div>
            <span class="card-badge green">${m30Sales.length} ventas</span>
          </div>
          <div class="card-body">
            ${top5.length===0
              ?`<div class="empty-state"><div class="es-icon">📦</div><p>Sin ventas registradas aún</p></div>`
              :top5.map(([name,qty],i)=>{
                const p=state.products.find(x=>x.name===name);
                const avgDay=qty/30;
                const dias=p&&avgDay>0?Math.round(p.stock/avgDay):null;
                const diasColor=dias===null?'var(--text2)':dias<=3?'var(--red)':dias<=7?'var(--warn)':'var(--text2)';
                return `<div class="top-product">
                  <div class="top-product-head">
                    <span class="top-product-name">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'  '} ${name}</span>
                    <span class="top-product-qty">${qty} uds.</span>
                  </div>
                  <div class="stock-bar"><div class="stock-bar-fill" style="width:${Math.round((qty/maxQty)*100)}%;background:var(--acc)"></div></div>
                  <div class="top-product-meta">
                    ${p?`Margen: ${fmt(p.price-p.cost)}/ud`:''}
                    ${p?` · Stock: ${p.stock}`:''}
                    ${dias!==null?` · <span style="color:${diasColor}">~${dias} días</span>`:''}
                  </div>
                </div>`;
              }).join('')}
          </div>
        </div>

        <!-- Semana vs semana -->
        <div class="card">
          <div class="card-header"><div class="card-title">📊 Esta semana vs anterior</div></div>
          <div class="card-body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.85rem;margin-bottom:.85rem">
              <div style="text-align:center;padding:1rem;background:var(--surface2);border-radius:var(--r)">
                <div style="font-size:.7rem;font-weight:600;color:var(--text2);margin-bottom:.35rem;text-transform:uppercase">Esta semana</div>
                <div style="font-size:1.5rem;font-weight:800;color:var(--acc)">${fmt(wkInc)}</div>
                <div style="font-size:.72rem;color:var(--text2);margin-top:.2rem">${wkSales.length} ventas</div>
              </div>
              <div style="text-align:center;padding:1rem;background:var(--surface2);border-radius:var(--r)">
                <div style="font-size:.7rem;font-weight:600;color:var(--text2);margin-bottom:.35rem;text-transform:uppercase">Semana anterior</div>
                <div style="font-size:1.5rem;font-weight:800;color:var(--text2)">${fmt(pwkInc)}</div>
                <div style="font-size:.72rem;color:var(--text2);margin-top:.2rem">${pwkSales.length} ventas</div>
              </div>
            </div>
            ${wkDiff!==null?`<div style="text-align:center;font-size:.85rem;font-weight:700;padding:.6rem;border-radius:var(--r);background:${wkDiff>=0?'var(--acc-dim)':'var(--red-dim)'};color:${wkDiff>=0?'var(--acc)':'var(--red)'}">
              ${wkDiff>=0?'▲':'▼'} ${Math.abs(wkDiff)}% ${wkDiff>=0?'más que':'menos que'} la semana pasada
            </div>`:''}
          </div>
        </div>

        ${dead.length>0?`<div class="card">
          <div class="card-header"><div class="card-title">💀 Sin movimiento — 30 días</div><span class="card-badge red">${dead.length}</span></div>
          <table class="tbl">
            <thead><tr><th>Producto</th><th>Stock</th><th>Capital inmovilizado</th></tr></thead>
            <tbody>${dead.map(p=>`<tr>
              <td>${p.emoji||'📦'} ${p.name}</td>
              <td><span class="pill low">${p.stock} uds.</span></td>
              <td class="mono" style="color:var(--warn)">${fmt(p.stock*p.cost)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>`:''}
      </div>

      <!-- COLUMNA DERECHA -->
      <div style="display:flex;flex-direction:column;gap:1rem">

        <!-- Alertas rápidas -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🚨 Stock crítico</div>
            <button onclick="navigate('alertas')" class="btn-link" style="font-size:.78rem">Ver todo →</button>
          </div>
          <div class="card-body">
            ${alerts.length===0
              ?`<div style="text-align:center;color:var(--acc);font-size:.85rem;padding:.5rem">✓ Todo el stock está en orden</div>`
              :`<div style="display:flex;flex-direction:column;gap:.5rem">${alerts.map(p=>`
                <div class="alert-item">
                  <div class="alert-dot ${p.stock===0?'red':'warn'}"></div>
                  <div class="alert-info">
                    <div class="alert-name">${p.emoji||'📦'} ${p.name}</div>
                    <div class="alert-detail">${p.stock===0?'Sin stock':`${p.stock} uds. (mín: ${p.minStock})`}</div>
                  </div>
                  <span class="alert-tag ${p.stock===0?'red':'warn'}">${p.stock===0?'URGENTE':'BAJO'}</span>
                </div>`).join('')}</div>`}
          </div>
        </div>

        <!-- Cierre del día -->
        <div class="card">
          <div class="card-header"><div class="card-title">🔒 Cierre del día</div></div>
          <div class="card-body">
            <div style="display:flex;flex-direction:column;gap:.6rem">
              <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem .85rem;background:var(--surface2);border-radius:var(--r)">
                <span style="font-size:.83rem;color:var(--text2)">Ventas del día</span>
                <span style="font-weight:700;color:var(--acc);font-family:var(--font-mono)">${todaySales.length}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem .85rem;background:var(--surface2);border-radius:var(--r)">
                <span style="font-size:.83rem;color:var(--text2)">Total recaudado</span>
                <span style="font-weight:700;color:var(--acc);font-family:var(--font-mono)">${fmt(income)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem .85rem;background:var(--surface2);border-radius:var(--r)">
                <span style="font-size:.83rem;color:var(--text2)">Costo de lo vendido</span>
                <span style="font-weight:700;color:var(--warn);font-family:var(--font-mono)">${fmt(cost)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem .85rem;background:var(--acc-dim);border:1px solid var(--acc);border-radius:var(--r)">
                <span style="font-size:.88rem;font-weight:700">Ganancia del día</span>
                <span style="font-size:1.1rem;font-weight:800;color:var(--acc);font-family:var(--font-mono)">${fmt(profit)}</span>
              </div>
              <div style="text-align:center;font-size:.75rem;color:var(--text2);margin-top:.15rem">
                Comparado con ayer:
                ${(()=>{
                  const ayer=new Date(now); ayer.setDate(now.getDate()-1);
                  const ayerStr=ayer.toLocaleDateString('es-CL');
                  const ayerSales=state.sales.filter(s=>toDate(s.createdAt).toLocaleDateString('es-CL')===ayerStr);
                  const ayerInc=ayerSales.reduce((s,x)=>s+x.total,0);
                  if(!ayerInc) return '<span>primer día de registro</span>';
                  const diff=Math.round(((income-ayerInc)/ayerInc)*100);
                  return `<span style="color:${diff>=0?'var(--acc)':'var(--red)';font-weight:600}">${diff>=0?'▲':'▼'} ${Math.abs(diff)}% vs ayer (${fmt(ayerInc)})</span>`;
                })()}
              </div>
            </div>
          </div>
        </div>

        <!-- Última actividad -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">⚡ Última actividad</div>
            <button onclick="navigate('historial')" class="btn-link" style="font-size:.78rem">Ver todo →</button>
          </div>
          <div>
            ${state.sales.slice(0,5).map(s=>{
              const d=toDate(s.createdAt);
              return `<div class="hist-row">
                <div>
                  <div class="hist-time">${d.toLocaleDateString('es-CL')} ${d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}</div>
                  <div class="hist-desc">${(s.items||[]).slice(0,2).map(i=>`${i.qty}× ${i.name}`).join(', ')}${(s.items||[]).length>2?` +${s.items.length-2} más`:''}</div>
                </div>
                <div class="hist-amount">${fmt(s.total)}</div>
              </div>`;
            }).join('')||`<div style="padding:1rem;text-align:center;color:var(--text2);font-size:.83rem">Sin ventas hoy</div>`}
          </div>
        </div>
      </div>
    </div>`;
}
