// ════════════════════════════════════════
// dashboard.js — Métricas, alertas, análisis
// ════════════════════════════════════════

import { state, fmt, toDate } from './utils.js';

// ── RENDER DASHBOARD ──
export function renderDashboard(container) {
  if (container) container.innerHTML = `<div id="dash-inner" style="padding:.85rem;display:flex;flex-direction:column;gap:1.25rem;overflow-y:auto;height:100%"></div>`;
  _buildDash();
  window.addEventListener('sales-updated',    _buildDash);
  window.addEventListener('products-updated', _buildDash);
}

function _buildDash() {
  const el = document.getElementById('dash-inner');
  if (!el) {
    window.removeEventListener('sales-updated', _buildDash);
    window.removeEventListener('products-updated', _buildDash);
    return;
  }

  const now  = new Date();
  const today = now.toLocaleDateString('es-CL');

  // Rangos de tiempo
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // lunes
  weekStart.setHours(0,0,0,0);
  const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(weekStart.getDate() - 7);
  const prevWeekEnd   = new Date(weekStart); prevWeekEnd.setMilliseconds(-1);
  const month30       = new Date(now);       month30.setDate(now.getDate() - 30);

  const todaySales    = state.sales.filter(s => toDate(s.createdAt).toLocaleDateString('es-CL') === today);
  const weekSales     = state.sales.filter(s => toDate(s.createdAt) >= weekStart);
  const prevWeekSales = state.sales.filter(s => { const d = toDate(s.createdAt); return d >= prevWeekStart && d <= prevWeekEnd; });
  const recentSales   = state.sales.filter(s => toDate(s.createdAt) >= month30);

  // KPIs
  const income   = todaySales.reduce((s, x) => s + x.total, 0);
  const costSold = todaySales.reduce((s, x) => s + x.cost,  0);
  const profit   = income - costSold;
  const margin   = income > 0 ? Math.round((profit / income) * 100) : 0;
  const invested = state.products.reduce((s, p) => s + p.cost * p.stock, 0);
  const alerts   = state.products.filter(p => p.stock <= p.minStock).length;
  const weekIncome = weekSales.reduce((s, x) => s + x.total, 0);
  const prevIncome = prevWeekSales.reduce((s, x) => s + x.total, 0);
  const weekDiff   = prevIncome > 0 ? Math.round(((weekIncome - prevIncome) / prevIncome) * 100) : null;

  // Rotación 30 días
  const rotation = {};
  recentSales.forEach(s => (s.items || []).forEach(i => {
    rotation[i.name] = (rotation[i.name] || 0) + i.qty;
  }));
  const topProducts = Object.entries(rotation).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Stock muerto
  const soldNames  = new Set(Object.keys(rotation));
  const deadStock  = state.products.filter(p => p.stock > 0 && !soldNames.has(p.name));

  // Días de stock restante por producto
  const avgDailySales = {};
  recentSales.forEach(s => (s.items || []).forEach(i => {
    avgDailySales[i.name] = (avgDailySales[i.name] || 0) + i.qty;
  }));
  Object.keys(avgDailySales).forEach(k => { avgDailySales[k] = avgDailySales[k] / 30; });

  el.innerHTML = `
    <!-- KPIs principales -->
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-l">Ingresos hoy</div><div class="kpi-v g">${fmt(income)}</div><div class="kpi-s">${todaySales.length} venta${todaySales.length!==1?'s':''}</div></div>
      <div class="kpi"><div class="kpi-l">Ganancia hoy</div><div class="kpi-v a">${fmt(profit)}</div><div class="kpi-s">margen ${margin}%</div></div>
      <div class="kpi"><div class="kpi-l">Esta semana</div><div class="kpi-v g">${fmt(weekIncome)}</div>
        <div class="kpi-s">${weekDiff !== null ? `<span style="color:${weekDiff>=0?'var(--ok)':'var(--danger)'}">${weekDiff>=0?'▲':'▼'} ${Math.abs(weekDiff)}%</span> vs sem. ant.` : 'primera semana'}</div>
      </div>
      <div class="kpi"><div class="kpi-l">Stock invertido</div><div class="kpi-v o">${fmt(invested)}</div><div class="kpi-s">${alerts ? `<span style="color:var(--danger)">${alerts} alerta${alerts!==1?'s':''}</span>` : '✓ sin alertas'}</div></div>
    </div>

    <!-- Rotación top productos -->
    <div>
      <div class="sec-t">🔥 Productos más vendidos — 30 días</div>
      ${topProducts.length === 0
        ? `<div style="color:var(--muted);font-size:.83rem">Sin ventas registradas aún.</div>`
        : topProducts.map(([name, qty], i) => {
            const p = state.products.find(x => x.name === name);
            const maxQty = topProducts[0][1];
            const pct    = Math.round((qty / maxQty) * 100);
            const dias   = avgDailySales[name] > 0 && p ? Math.round(p.stock / avgDailySales[name]) : null;
            return `<div style="margin-bottom:.7rem">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.25rem">
                <span style="font-size:.85rem;font-weight:500">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'  '} ${name}</span>
                <span style="font-size:.8rem;color:var(--acc);font-weight:700">${qty} uds.</span>
              </div>
              <div style="background:var(--s2);border-radius:20px;height:5px;overflow:hidden">
                <div style="background:var(--acc);height:100%;width:${pct}%;border-radius:20px"></div>
              </div>
              <div style="font-size:.68rem;color:var(--muted);margin-top:.18rem;display:flex;gap:.75rem">
                ${p ? `<span>Margen: ${fmt(p.price - p.cost)}/ud</span>` : ''}
                ${p ? `<span>Stock: ${p.stock}</span>` : ''}
                ${dias !== null ? `<span style="color:${dias<=7?'var(--danger)':dias<=14?'var(--warn)':'var(--muted)'}">~${dias} días de stock</span>` : ''}
              </div>
            </div>`;
          }).join('')}
    </div>

    <!-- Semana vs semana anterior -->
    <div>
      <div class="sec-t">📊 Esta semana vs semana anterior</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:.6rem">
        <div class="kpi">
          <div class="kpi-l">Esta semana</div>
          <div class="kpi-v g">${fmt(weekIncome)}</div>
          <div class="kpi-s">${weekSales.length} ventas</div>
        </div>
        <div class="kpi">
          <div class="kpi-l">Semana anterior</div>
          <div class="kpi-v" style="color:var(--muted);font-size:1.1rem">${fmt(prevIncome)}</div>
          <div class="kpi-s">${prevWeekSales.length} ventas</div>
        </div>
      </div>
      ${weekDiff !== null
        ? `<div style="text-align:center;font-size:.82rem;font-weight:600;padding:.5rem;border-radius:10px;background:${weekDiff>=0?'rgba(0,229,160,.08)':'rgba(255,58,58,.08)'};color:${weekDiff>=0?'var(--ok)':'var(--danger)'}">
            ${weekDiff>=0?'▲':'▼'} ${Math.abs(weekDiff)}% ${weekDiff>=0?'más':'menos'} que la semana pasada
          </div>`
        : ''}
    </div>

    <!-- Stock muerto -->
    ${deadStock.length > 0 ? `
    <div>
      <div class="sec-t">💀 Stock sin movimiento — 30 días</div>
      ${deadStock.map(p => `
        <div class="sale-row" style="margin-bottom:.45rem">
          <div>
            <div style="font-size:.85rem;font-weight:500">${p.emoji||'📦'} ${p.name}</div>
            <div style="font-size:.7rem;color:var(--muted)">${p.stock} uds. · Capital inmovilizado: ${fmt(p.stock*p.cost)}</div>
          </div>
          <div style="font-size:.72rem;color:var(--danger);font-weight:700;text-align:right">SIN<br>MOVIMIENTO</div>
        </div>`).join('')}
    </div>` : ''}
  `;
}

// ── RENDER ALERTAS ──
export function renderAlertas(container) {
  if (container) container.innerHTML = `<div id="alert-inner" style="padding:.85rem;display:flex;flex-direction:column;gap:1rem;overflow-y:auto;height:100%"></div>`;
  _buildAlerts();
  window.addEventListener('products-updated', _buildAlerts);
}

function _buildAlerts() {
  const el = document.getElementById('alert-inner');
  if (!el) { window.removeEventListener('products-updated', _buildAlerts); return; }

  const critical = state.products.filter(p => p.stock === 0);
  const low      = state.products.filter(p => p.stock > 0 && p.stock <= p.minStock);
  const all      = [...critical, ...low];

  const alertHTML = all.length === 0
    ? `<div style="color:var(--ok);font-size:.88rem">✓ Todo el stock está en orden</div>`
    : all.map(p => `
        <div class="alert-item">
          <div class="adot ${p.stock===0?'r':'w'}"></div>
          <div style="flex:1">
            <div style="font-size:.88rem;font-weight:500">${p.emoji||'📦'} ${p.name}</div>
            <div style="font-size:.73rem;color:var(--muted);margin-top:.1rem">${p.stock===0?'Sin stock':`Solo ${p.stock} uds. (mín: ${p.minStock})`}</div>
          </div>
          <div style="font-size:.72rem;font-weight:700;color:${p.stock===0?'var(--danger)':'var(--warn)'}">${p.stock===0?'URGENTE':'PRONTO'}</div>
        </div>`).join('');

  const buyHTML = all.length === 0
    ? `<div style="color:var(--muted);font-size:.83rem">No hay compras urgentes.</div>`
    : all.map(p => {
        const toBuy = Math.max(p.minStock * 3 - p.stock, p.minStock);
        return `<div class="buy-item">
          <div>
            <div style="font-size:.85rem;font-weight:500">${p.emoji||'📦'} ${p.name}</div>
            <div style="font-size:.7rem;color:var(--muted)">Stock actual: ${p.stock}</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:'Syne',sans-serif;font-weight:800;color:var(--acc)">${toBuy} uds.</div>
            <div style="font-size:.7rem;color:var(--muted)">≈ ${fmt(toBuy * p.cost)}</div>
          </div>
        </div>`;
      }).join('');

  el.innerHTML = `
    <div><div class="sec-t">⚡ Stock crítico</div><div style="display:flex;flex-direction:column;gap:.5rem">${alertHTML}</div></div>
    <div><div class="sec-t">🛒 Lista de compras sugerida</div><div style="display:flex;flex-direction:column;gap:.5rem">${buyHTML}</div></div>
  `;
}

export function updateAlertBadge() {
  const cnt = state.products.filter(p => p.stock <= p.minStock).length;
  const b   = document.getElementById('alert-badge');
  if (!b) return;
  b.textContent   = cnt;
  b.style.display = cnt > 0 ? 'inline' : 'none';
}
