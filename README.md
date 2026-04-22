# StockBarrio 📦

Control de inventario para negocios pequeños de barrio.

## Estructura del proyecto

```
StockBarrio/
├── index.html          ← HTML puro, sin lógica
├── css/
│   └── style.css       ← Todos los estilos
├── js/
│   ├── firebase.js     ← Config Firebase + offline persistence
│   ├── utils.js        ← Estado global, formato moneda, toast
│   ├── auth.js         ← Login dueño, PIN vendedor, sesión
│   ├── app.js          ← Orquestador: routing y navegación
│   ├── sales.js        ← Carrito, ventas, cola offline
│   ├── inventory.js    ← CRUD productos, eliminar
│   ├── dashboard.js    ← KPIs, rotación, comparativo semanal
│   ├── scanner.js      ← Cámara + pistola lectora HID
│   └── vendors.js      ← Gestión vendedores y PINs
└── README.md
```

## Funcionalidades

### Para el dueño 👑
- Dashboard con ingresos, ganancia y margen del día
- Top productos más vendidos (30 días) con días de stock restante
- Comparativo esta semana vs semana anterior
- Detección de stock muerto (sin movimiento en 30 días)
- Alertas de quiebre y lista de compras sugerida
- Inventario con ajuste de stock y eliminación de productos
- Historial de ventas con nombre del vendedor
- Gestión de vendedores con PIN de 4 dígitos

### Para el vendedor 🛍️
- Vista de productos con búsqueda
- Carrito con control de cantidad
- Cobro con confirmación
- Escaneo por cámara o pistola lectora HID
- **Modo offline**: las ventas se guardan localmente y sincronizan al reconectar

## Configuración Firebase

Las credenciales están en `js/firebase.js`. Servicios necesarios:
1. **Authentication** → Email/contraseña activado
2. **Firestore** → Reglas: `allow read, write: if request.auth != null`
3. **Hosting** (opcional) → Para subir con `firebase deploy`

## Despliegue en GitHub Pages

```bash
git add .
git commit -m "StockBarrio v1.0"
git push
```
Luego: Settings → Pages → Source: main branch

## Notas técnicas

- Usa **ES Modules** nativos (no requiere bundler)
- **IndexedDB persistence** de Firestore para modo offline
- Vendedores no necesitan email — solo código de negocio + PIN
- El código de negocio se genera automáticamente desde el nombre del negocio

## Modelo de negocio — Paquetes

| Pack     | Incluye                              | Precio sugerido |
|----------|--------------------------------------|-----------------|
| Básico   | Sistema StockBarrio                  | $25.000 CLP     |
| Pro      | Sistema + toma de inventario inicial | $55.000 CLP     |
| Pro II   | Sistema + capturadora lectora        | $65.000 CLP     |
| Premium  | Todo incluido                        | $90.000 CLP     |
