# Naftometro - Arquitectura y Stack Tecnologico

## Que es Naftometro

Naftometro es una Progressive Web App (PWA) para calcular y distribuir costos de combustible entre multiples conductores que comparten un vehiculo. Desarrollada en Vanilla JS sin frameworks, esta optimizada para funcionar como app nativa en iPhone y Android.

**Repositorio:** github.com/patomclean/naftometro
**Deploy:** Vercel (auto-deploy desde rama `main`)

---

## Stack Tecnologico

### Frontend
- **HTML5** — Estructura semantica, formularios nativos, `<details>` para acordeones
- **CSS3** — Custom properties, Flexbox, CSS Grid, Glass Morphism, media queries responsivas
- **JavaScript (ES2020+)** — Vanilla JS, async/await, Modules via CDN, sin bundler

### Backend
- **Supabase** — PostgreSQL como base de datos, autenticacion anonima, Storage para fotos
- **URL:** `https://vablrtbwxitoiqyzyama.supabase.co`
- **SDK:** `@supabase/supabase-js@2` cargado via CDN de jsDelivr

### PWA
- **Service Worker** — Cache-first para assets estaticos, network-first para Supabase
- **manifest.json** — Instalable como app standalone en portrait
- **Tema:** `#0f0c29` (dark purple gradient)

### Deploy y CI/CD
- **Vercel** — Auto-deploy desde GitHub en cada push a `main`
- **Cache busting** — Query strings en assets (`style.css?v=15.8`, `app.js?v=15.8`)

---

## Estructura de Archivos

```
fuel-calculator/
  index.html          — Estructura HTML completa (517 lineas)
  app.js              — Logica de negocio, estado, UI (3050+ lineas)
  style.css           — Estilos completos, responsive (2100+ lineas)
  sw.js               — Service Worker con estrategia de cache
  manifest.json       — Configuracion PWA (nombre, iconos, display)
  icons/
    icon-192.svg      — Icono 192x192 (letra N con gradiente)
    icon-512.svg      — Icono 512x512
    icon-maskable.svg — Icono para adaptive icons (sin bordes redondeados)
  docs/
    01_arquitectura_y_stack.md   — Este archivo
    02_logica_de_negocio.md      — Matematica y algoritmos
    03_historial_y_ui.md         — Evolucion de la interfaz
```

---

## Arquitectura de la Aplicacion

### Sistema de 3 Vistas (Carrusel Horizontal)

La app usa un carrusel horizontal con 3 vistas que se deslizan via CSS transforms:

```
.views-container (width: 300%, flex)
  |
  +-- VIEW 0: Vehiculos (Detalle)    transform: translateX(0)
  +-- VIEW 1: Home (default)         transform: translateX(-33.333%)
  +-- VIEW 2: Dashboard (Stats)      transform: translateX(-66.666%)
```

- **Transicion:** `350ms cubic-bezier(0.4, 0, 0.2, 1)`
- **Swipe:** Deteccion por touch events con threshold de `min(80px, 25% viewport)`
- **Clase `.swiping`:** Desactiva transicion durante el arrastre

### Navegacion Inferior

Barra fija (`position: fixed`) fuera del container de vistas. Tres tabs: Vehiculos, Home, Stats. Incluye `backdrop-filter: blur(20px)` para efecto glass.

---

### Sistema de Modales

La app tiene 6 modales:

| Modal | Funcion |
|-------|---------|
| Vehicle Modal | Crear/editar vehiculo (nombre, modelo, consumo, pilotos) |
| Payment Modal | Registrar carga de combustible (monto, litros, factura, foto) |
| Trip Modal | Registrar viaje (km, piloto, tipo de manejo, fecha) |
| Confirm Modal | Confirmacion generica para acciones destructivas |
| Vehicle Selector | Selector rapido cuando hay multiples vehiculos (v15.2) |
| Photo Viewer | Visor de foto a pantalla completa (v15.0) |

### Estado de la Aplicacion

Estado centralizado en un objeto `state` mutable:

```javascript
const state = {
  vehicles: [],              // Todos los vehiculos del usuario
  activeVehicleId: null,     // Vehiculo seleccionado actualmente
  trips: [],                 // Viajes del vehiculo activo
  payments: [],              // Pagos del vehiculo activo
  currentTab: 'home',        // Vista activa: 'detail' | 'home' | 'dashboard'
  dashboardLoaded: false,    // Cache del dashboard
  allTrips: [],              // Todos los viajes (para dashboard)
  allPayments: [],           // Todos los pagos (para dashboard)
  settlementMode: false,     // Modal de pago en modo liquidacion
  settlementDriver: null,    // Piloto siendo liquidado
  editingPaymentId: null,    // Pago en edicion
  editingTripId: null,       // Viaje en edicion
  balancesExpanded: false,   // Toggle master de tarjetas de balance
  pendingPhotoFile: null,    // Foto pendiente de subir (v15)
  photoRemoved: false,       // Flag de eliminacion de foto (v15)
  lastVisitedVehicleId: null // Ultimo vehiculo visitado (UX)
};
```

### Flujo de Datos

```
Usuario → Formulario → Validacion JS → Supabase Insert/Update
                                              |
                                              v
                                        Re-fetch datos
                                              |
                                              v
                                     Re-render componentes
                                     (balances, historial, resumen)
```

---

## Modelo de Datos (Supabase/PostgreSQL)

### Tabla: `vehicles`

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | serial | PK auto-generada |
| `name` | text | Nombre del vehiculo ("Auto familiar") |
| `model` | text | Modelo del vehiculo ("VW Gol Trend 1.6") |
| `consumption` | numeric | Consumo aprendido en km/l |
| `fuel_type` | text | Tipo de combustible ("Super 95 octanos") |
| `fuel_price` | numeric | Precio promedio ponderado del litro |
| `drivers` | text[] | Array de nombres de pilotos |
| `created_at` | timestamptz | Fecha de creacion |

### Tabla: `trips`

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | serial | PK auto-generada |
| `vehicle_id` | integer | FK a vehicles |
| `driver` | text | Nombre del piloto |
| `km` | numeric | Distancia recorrida |
| `liters` | numeric | Litros consumidos (calculado) |
| `cost` | numeric | Costo del viaje (calculado) |
| `drive_type` | text | "Urbano", "Ruta", o "Mixto" |
| `note` | text | Nota opcional |
| `occurred_at` | timestamptz | Fecha real del viaje |
| `is_reconciled` | boolean | Reconciliado con tanque lleno |
| `reconciled_at` | timestamptz | Fecha de reconciliacion |
| `original_consumption` | numeric | Consumo estimado original (km/l) |
| `real_consumption` | numeric | Consumo real ajustado (km/l) |
| `created_at` | timestamptz | Fecha de registro |

### Tabla: `payments`

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | serial | PK auto-generada |
| `vehicle_id` | integer | FK a vehicles |
| `driver` | text | Nombre del piloto |
| `amount` | numeric | Monto total pagado |
| `liters_loaded` | numeric | Litros cargados (null para saldos) |
| `price_per_liter` | numeric | Precio efectivo por litro |
| `is_full_tank` | boolean | Tanque llenado completamente |
| `invoice_type` | text | "Factura A" o "Ticket" |
| `tax_perceptions` | numeric | Percepciones fiscales |
| `discount_amount` | numeric | Descuentos aplicados |
| `note` | text | Nota opcional |
| `occurred_at` | timestamptz | Fecha real del pago |
| `photo_url` | text | URL de foto del ticket (v15) |
| `created_at` | timestamptz | Fecha de registro |

---

## Service Worker (sw.js)

### Estrategia de Cache

```
Supabase API (*.supabase.co) → Network-first (fallback a cache)
Assets estaticos (HTML, CSS, JS, iconos) → Cache-first (fallback a network)
```

### Ciclo de Vida

1. **Install:** Pre-cachea todos los assets de `STATIC_ASSETS`, llama `skipWaiting()`
2. **Activate:** Elimina caches antiguos (cualquier key !== `CACHE_NAME`), llama `clients.claim()`
3. **Fetch:** Intercepta requests y aplica la estrategia correspondiente

### Versionado

El nombre del cache (`naftometro-v15.8`) se bumpeea en cada release. Combinado con cache busting en `index.html` (`?v=15.8`), esto fuerza la actualizacion de assets en produccion.

---

## Sistema de Diseno

### Variables CSS (Custom Properties)

```css
/* Colores principales */
--color-primary: #7c5cfc        /* Violeta principal */
--color-success: #22c55e        /* Verde exito */
--color-danger: #ef4444         /* Rojo peligro */

/* Background */
--bg-gradient-start: #0f0c29    /* Gradiente oscuro */
--bg-gradient-mid: #1a1440
--bg-gradient-end: #24243e

/* Glass Morphism */
--glass-bg: rgba(255, 255, 255, 0.06)
--glass-border: rgba(255, 255, 255, 0.1)
--glass-blur: 12px

/* Tipografia */
--text-primary: #f1f1f1
--text-secondary: #a0a0b8
--text-muted: #6b6b80
```

### Breakpoints Responsivos

| Breakpoint | Target | Cambios principales |
|-----------|--------|---------------------|
| ≤480px | Moviles pequenos | Layout 1 columna, font-sizes reducidos, tabla → cards |
| ≤768px | Moviles/tablets | Scroll independiente iOS, padding compacto |
| ≥768px | Desktop/tablets grandes | Header grande, grid 2 columnas, modales centrados |

### Componentes Reutilizables

- **`.glass-card`** — Tarjeta con glass morphism (blur + border)
- **`.btn` / `.btn-primary` / `.btn-danger`** — Sistema de botones
- **`.btn-icon`** — Botones solo icono con min 44x44px (accesibilidad tactil)
- **`.badge`** — Badges informativos
- **`.meta-pill`** — Pills compactos para metadata (v15.7)
- **`.vehicle-pill`** — Selector horizontal de vehiculos
- **`.toast-container`** — Notificaciones emergentes animadas

---

## Base de Datos de Vehiculos

La app incluye una base de datos interna (`VEHICLE_DATABASE`) con especificaciones tecnicas de vehiculos argentinos populares:

```javascript
const VEHICLE_DATABASE = {
  "VW Gol Trend 1.6": { mixed_km_l: 12.5, city_km_l: 10.5, highway_km_l: 15.0, tank_capacity: 55 },
  "VW Taos 1.4 TSI":  { mixed_km_l: 13.5, city_km_l: 11.0, highway_km_l: 16.5, tank_capacity: 55 },
  // ... mas modelos
};
```

Cada modelo tiene:
- **mixed_km_l** — Consumo mixto (km/litro)
- **city_km_l** — Consumo urbano
- **highway_km_l** — Consumo en ruta
- **tank_capacity** — Capacidad del tanque en litros
