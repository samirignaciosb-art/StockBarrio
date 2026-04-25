// exports.js — Descarga de reportes en Excel
import { state, fmt, toDate } from './utils.js';

// ══════════════════════════════════════
// EXPORTAR STOCK ACTUAL
// ══════════════════════════════════════
export function exportStock() {
  const rows = [
    ['Producto', 'Emoji', 'EAN', 'Stock actual', 'Stock mínimo', 'Precio venta', 'Precio costo', 'Margen %', 'Valor stock', 'Estado'],
    ...state.products.map(p => {
      const margin = p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;
      const status = p.stock === 0 ? 'Sin stock' : p.stock <= p.minStock ? 'Stock bajo' : 'OK';
      return [
        p.name,
        p.emoji || '📦',
        p.ean || '',
        p.stock,
        p.minStock,
        p.price,
        p.cost,
        margin + '%',
        p.stock * p.cost,
        status
      ];
    })
  ];

  // Totales al final
  const totalInvested = state.products.reduce((s, p) => s + p.cost * p.stock, 0);
  const totalProducts = state.products.length;
  const critical      = state.products.filter(p => p.stock <= p.minStock).length;
  rows.push([]);
  rows.push(['RESUMEN', '', '', '', '', '', '', '', '', '']);
  rows.push(['Total productos', totalProducts]);
  rows.push(['Productos críticos', critical]);
  rows.push(['Capital invertido en stock', '', '', '', '', '', '', '', totalInvested]);

  downloadCSV(rows, `StockBarrio_Stock_${dateStr()}.csv`);
}

// ══════════════════════════════════════
// EXPORTAR HISTORIAL DE VENTAS
// ══════════════════════════════════════
export function exportSales() {
  const rows = [
    ['Fecha', 'Hora', 'Productos', 'Total venta', 'Costo', 'Ganancia', 'Margen %'],
    ...state.sales.map(s => {
      const d      = toDate(s.createdAt);
      const profit = s.total - (s.cost || 0);
      const margin = s.total > 0 ? Math.round((profit / s.total) * 100) : 0;
      const items  = (s.items || []).map(i => `${i.qty}x ${i.name}`).join(' | ');
      return [
        d.toLocaleDateString('es-CL'),
        d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        items,
        s.total,
        s.cost || 0,
        profit,
        margin + '%'
      ];
    })
  ];

  // Totales
  const totalIncome = state.sales.reduce((s, x) => s + x.total, 0);
  const totalCost   = state.sales.reduce((s, x) => s + (x.cost || 0), 0);
  const totalProfit = totalIncome - totalCost;
  rows.push([]);
  rows.push(['TOTALES', '', '', totalIncome, totalCost, totalProfit]);

  downloadCSV(rows, `StockBarrio_Ventas_${dateStr()}.csv`);
}

// ══════════════════════════════════════
// EXPORTAR LISTA DE COMPRAS
// ══════════════════════════════════════
export function exportBuyList() {
  const critical = state.products.filter(p => p.stock === 0);
  const low      = state.products.filter(p => p.stock > 0 && p.stock <= p.minStock);
  const all      = [...critical, ...low];

  if (!all.length) {
    alert('No hay productos críticos que comprar. ¡Todo el stock está en orden!');
    return;
  }

  const rows = [
    [`Lista de compras — ${new Date().toLocaleDateString('es-CL')}`],
    ['Negocio: ' + state.storeName],
    [],
    ['Producto', 'Stock actual', 'Stock mínimo', 'Cantidad sugerida', 'Costo unit.', 'Costo total estimado', 'Urgencia'],
    ...all.map(p => {
      const toBuy    = Math.max(p.minStock * 3 - p.stock, p.minStock);
      const urgency  = p.stock === 0 ? 'URGENTE' : 'Pronto';
      return [
        p.name,
        p.stock,
        p.minStock,
        toBuy,
        p.cost,
        toBuy * p.cost,
        urgency
      ];
    })
  ];

  // Total estimado
  const totalEstimated = all.reduce((s, p) => {
    const toBuy = Math.max(p.minStock * 3 - p.stock, p.minStock);
    return s + toBuy * p.cost;
  }, 0);
  rows.push([]);
  rows.push(['TOTAL ESTIMADO DE COMPRA', '', '', '', '', totalEstimated]);

  downloadCSV(rows, `StockBarrio_ListaCompras_${dateStr()}.csv`);
}

// ══════════════════════════════════════
// RENDER VISTA REPORTES
// ══════════════════════════════════════
export function renderReportes(c) {
  const now       = new Date();
  const todayStr  = now.toLocaleDateString('es-CL');
  const todaySales= state.sales.filter(s => toDate(s.createdAt).toLocaleDateString('es-CL') === todayStr);
  const income    = todaySales.reduce((s, x) => s + x.total, 0);
  const profit    = income - todaySales.reduce((s, x) => s + (x.cost || 0), 0);
  const critical  = state.products.filter(p => p.stock <= p.minStock).length;
  const invested  = state.products.reduce((s, p) => s + p.cost * p.stock, 0);

  c.innerHTML = `
    <div style="max-width:700px;animation:fadeIn .3s ease">

      <!-- Resumen rápido -->
      <div class="kpi-row" style="margin-bottom:1.25rem">
        <div class="kpi-card green">
          <div class="kpi-icon">💰</div>
          <div class="kpi-label">Ventas hoy</div>
          <div class="kpi-value green">${fmt(income)}</div>
          <div class="kpi-sub">${todaySales.length} transacciones</div>
        </div>
        <div class="kpi-card blue">
          <div class="kpi-icon">📈</div>
          <div class="kpi-label">Ganancia hoy</div>
          <div class="kpi-value blue">${fmt(profit)}</div>
          <div class="kpi-sub">${income > 0 ? Math.round((profit/income)*100) : 0}% margen</div>
        </div>
        <div class="kpi-card warn">
          <div class="kpi-icon">🏪</div>
          <div class="kpi-label">Capital stock</div>
          <div class="kpi-value warn">${fmt(invested)}</div>
          <div class="kpi-sub">${state.products.length} productos</div>
        </div>
        <div class="kpi-card ${critical > 0 ? 'red' : 'green'}">
          <div class="kpi-icon">${critical > 0 ? '🚨' : '✅'}</div>
          <div class="kpi-label">Críticos</div>
          <div class="kpi-value ${critical > 0 ? 'red' : 'green'}">${critical}</div>
          <div class="kpi-sub">necesitan reposición</div>
        </div>
      </div>

      <!-- Descargas -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📥 Descargar reportes</div>
          <span style="font-size:.72rem;color:var(--text2)">Formato CSV — abre en Excel</span>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:.85rem">

          <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.1rem;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);gap:1rem">
            <div>
              <div style="font-size:.92rem;font-weight:600;margin-bottom:.2rem">📦 Stock actual</div>
              <div style="font-size:.75rem;color:var(--text2)">Inventario completo con precios, márgenes y estado de cada producto</div>
            </div>
            <button class="btn-sm" onclick="downloadStock()" style="flex-shrink:0">
              ⬇ Descargar
            </button>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.1rem;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);gap:1rem">
            <div>
              <div style="font-size:.92rem;font-weight:600;margin-bottom:.2rem">📋 Historial de ventas</div>
              <div style="font-size:.75rem;color:var(--text2)">Todas las ventas registradas con fecha, productos, total y ganancia</div>
            </div>
            <button class="btn-sm" onclick="downloadSales()" style="flex-shrink:0">
              ⬇ Descargar
            </button>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.1rem;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);gap:1rem">
            <div>
              <div style="font-size:.92rem;font-weight:600;margin-bottom:.2rem">🛒 Lista de compras</div>
              <div style="font-size:.75rem;color:var(--text2)">Productos con stock bajo o sin stock, con cantidades sugeridas y costo estimado</div>
            </div>
            <button class="btn-sm" onclick="downloadBuyList()" style="flex-shrink:0">
              ⬇ Descargar
            </button>
          </div>

        </div>
      </div>

      <!-- Nota -->
      <div style="margin-top:.85rem;font-size:.75rem;color:var(--text2);text-align:center;line-height:1.6">
        Los archivos CSV se abren directamente en Microsoft Excel, Google Sheets o Numbers.<br>
        Si los números aparecen con punto en vez de coma, selecciona la columna → Formato → Número.
      </div>
    </div>`;
}

// ══════════════════════════════════════
// UTILIDADES CSV
// ══════════════════════════════════════
function downloadCSV(rows, filename) {
  // BOM para que Excel en español reconozca tildes y ñ
  const BOM = '\uFEFF';
  const csv = BOM + rows.map(row =>
    row.map(cell => {
      const val = cell === null || cell === undefined ? '' : String(cell);
      // Escapar comillas y envolver en comillas si tiene comas o saltos
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    }).join(',')
  ).join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
}

function dateStr() {
  return new Date().toLocaleDateString('es-CL').replace(/\//g, '-');
}

// ── GLOBALS ──
window.downloadStock   = exportStock;
window.downloadSales   = exportSales;
window.downloadBuyList = exportBuyList;
