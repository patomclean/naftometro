# Naftometro - Arquitectura y Stack Tecnologico

## Que es Naftometro

Naftometro es una Progressive Web App (PWA) para calcular y distribuir costos de combustible entre multiples conductores que comparten un vehiculo. Desarrollada en Vanilla JS sin frameworks, esta optimizada para funcionar como app nativa en iPhone y Android.

**Repositorio:** github.com/patomclean/naftometro
**Version actual:** v18.15
**Deploy:** Vercel (auto-deploy desde rama `main`)

---

## Stack Tecnologico

### Frontend
- **HTML5** — Estructura semantica, formularios nativos, `<details>` para acordeones
- **CSS3** — Custom properties, Flexbox, CSS Grid, Glass Morphism, media queries responsivas
- **JavaScript (ES2020+)** — Vanilla JS, async/await, Modules via CDN, sin bundler
- **Chart.js** — Visualizaciones graficas (v18.8+): doughnut de KM por piloto y mixed bar/line de gastos

### Backend
- **Supabase** — PostgreSQL como base de datos, autenticacion por email/password, Storage para fotos
- **URL:** `https://vablrtbwxitoiqyzyama.supabase.co`
- **SDK:** `@supabase/supabase-js@2` cargado via CDN de jsDelivr
- **Auth:** Supabase Auth (email/password) — activado desde v18. Antes era anonimo.
- **RLS:** Row Level Security habilitado en todas las tablas desde v16.0

### PWA
- **Service Worker** — Cache-first para assets estaticos, network-first para Supabase
- **manifest.json** — Instalable como app standalone en portrait
- **Tema:** `#0f0c29` (dark purple gradient)

### Deploy y CI/CD
- **Vercel** — Auto-deploy desde GitHub en cada push a `main`
- **vercel.json** — Configuracion de rutas y reescrituras para SPA
- **Cache busting** — Query strings en assets (`style.css?v=18.15`, `app.js?v=18.15`)

---

## Estructura de Archivos

```
fuel-calculator/
  index.html                    — Estructura HTML completa (~517 lineas)
  app.js                        — Logica de negocio, estado, UI (~4328 lineas)
  style.css                     — Estilos completos, responsive (~2100+ lineas)
  sw.js                         — Service Worker con estrategia de cache
  manifest.json                 — Configuracion PWA (nombre, iconos, display)
  vercel.json                   — Configuracion de deploy en Vercel
  icons/
    icon-192.svg                — Icono 192x192 (letra N con gradiente)
    icon-512.svg                — Icono 512x512
    icon-maskable.svg           — Icono para adaptive icons (sin bordes redondeados)
  docs/
    01_arquitectura_y_stack.md  — Este archivo
    02_logica_de_negocio.md     — Matematica y algoritmos
    03_historial_y_ui.md        — Evolucion de la interfaz y versiones
    04_esquema_supabase.md      — Esquema completo de base de datos
  supabase_v16_migration.sql    — Multi-tenant, vehicle_members, RLS
  v16.2_invitations.sql         — Codigos de invitacion, join_vehicle_by_code RPC
  v17.0_ledger_schema.sql       — Libro contable inmutable, columnas PPP
  v18.0_auth_and_mapping.sql    — profiles, vehicle_driver_mappings, triggers de auth
  v18.4_data_integrity.sql      — Cascade triggers, limpieza de orphans en ledger
  v18.5_audit_logs.sql          — audit_logs, triggers INSERT/DELETE automaticos
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
- **Threshold vertical:** 50px — diferencia swipe horizontal de scroll vertical
- **Clase `.swiping`:** Desactiva transicion durante el arrastre para seguimiento en tiempo real
- **Haptic feedback:** Se dispara al completar un swipe (vibration API)

### Sistema de Sub-tabs en Vista Detalle (v18.5+)

Dentro de la Vista Detalle (Vehiculos), hay 3 sub-tabs:

```
[Resumen] [El Vehiculo] [Finanzas]
   ↑           ↑            ↑
summary     vehicle      finances
```

- **Resumen** — Smart Card personal, Actor List ordenado por gasto, Tank Indicator, graficos Chart.js
- **El Vehiculo** — Info tecnica del vehiculo, historial de viajes con badges de reconciliacion
- **Finanzas** — Activity feed paginado (cargas + liquidaciones + audit events), balances por piloto

La funcion `switchDetailTab(tab)` controla la visibilidad de los paneles y carga lazy el feed de actividad al primer ingreso a "finanzas".

### Navegacion Inferior

Barra fija (`position: fixed`) fuera del container de vistas. Tres tabs: Vehiculos, Home, Stats. Incluye `backdrop-filter: blur(20px)` para efecto glass.

---

### Sistema de Modales

La app tiene 12 modales:

| Modal | ID / Funcion | Version |
|-------|-------------|---------|
| Vehicle Modal | Crear/editar vehiculo (nombre, modelo, consumo, pilotos) | v1+ |
| Payment Modal | Registrar carga de combustible (monto, litros, factura, foto) | v1+ |
| Trip Modal | Registrar viaje (km, piloto, tipo de manejo, fecha) | v1+ |
| Confirm Modal | Confirmacion generica para acciones destructivas | v1+ |
| Vehicle Selector | Selector rapido cuando hay multiples vehiculos | v15.2 |
| Photo Viewer | Visor de foto de ticket a pantalla completa | v15.0 |
| Welcome Modal | Onboarding educativo (se muestra una vez via localStorage) | v15.9 |
| Auth Modal | Login y registro con email/password | v18 |
| Onboarding Modal | Completar perfil de usuario (display_name, currency) | v18 |
| Avatar Claim Modal | Seleccionar piloto correspondiente al usuario | v18 |
| Claim Identity Modal | Auto-popup contextual si usuario logueado no tiene mapping | v18.14 |
| Settle Debt Modal | Saldar deuda con acreedor, con monto prellenado | v18.6 |

### Estado de la Aplicacion

Estado centralizado en un objeto `state` mutable. No se usa Redux, Zustand ni ningun gestor de estado externo — todo el estado vive en este objeto y se actualiza directamente:

```javascript
const state = {
  // Vehiculos y navegacion
  vehicles: [],                 // Todos los vehiculos del usuario
  activeVehicleId: null,        // Vehiculo seleccionado actualmente
  lastVisitedVehicleId: null,   // Ultimo vehiculo visitado (UX: auto-select)
  currentTab: 'home',           // Vista activa: 'detail' | 'home' | 'dashboard'
  activeDetailTab: 'summary',   // Sub-tab activo en detalle: 'summary' | 'vehicle' | 'finances'

  // Datos del vehiculo activo
  trips: [],                    // Viajes del vehiculo activo
  payments: [],                 // Pagos del vehiculo activo
  ledger: [],                   // Entradas del libro contable (v17)
  driverMappings: [],           // Mapeos usuario→piloto del vehiculo activo (v18)
  auditLogs: [],                // Registro de auditoria del vehiculo activo (v18.5)

  // Feed de actividad (tab Finanzas)
  activityItems: [],            // Items combinados y ordenados del feed (v18.5)
  activityPage: 0,              // Cursor de paginacion (v18.5)

  // UI State
  confirmAction: null,          // Accion pendiente de confirmacion en modal
  settlementMode: false,        // Modal de pago en modo liquidacion
  settlementDriver: null,       // Piloto siendo liquidado
  editingPaymentId: null,       // Pago en edicion
  editingTripId: null,          // Viaje en edicion
  balancesExpanded: false,      // Toggle master de seccion balances

  // Foto del ticket
  pendingPhotoFile: null,       // Foto pendiente de subir (v15)
  photoRemoved: false,          // Flag de eliminacion de foto (v15)

  // Dashboard
  dashboardLoaded: false,       // Cache del dashboard (evita re-fetches innecesarios)
  allTrips: [],                 // Todos los viajes de todos los vehiculos (dashboard)
  allPayments: [],              // Todos los pagos de todos los vehiculos (dashboard)

  // Autenticacion (v18)
  profile: null,                // Perfil del usuario logueado (tabla profiles)
};
```

### Constantes Globales

```javascript
// Paleta de colores por piloto (se asigna por indice en vehicle.drivers[])
const PILOT_COLORS = ['#7c5cfc', '#f59e0b', '#06b6d4', '#ec4899', '#10b981', '#f43f5e'];

// Tipos de combustible disponibles en el selector de vehiculo
const FUEL_TYPES = [
  'Super (95 octanos)',
  'Premium (98 octanos)',
  'Diesel / Gasoil',
  'Infinia / V-Power',
];

// Nombres de las 3 vistas principales
const TABS = ['detail', 'home', 'dashboard'];

// Cantidad de items por pagina en el feed de actividad (v18.5)
const ACTIVITY_PAGE_SIZE = 10;

// Instancias de Chart.js (v18.8)
let kmChart = null;    // Doughnut: KM por piloto del mes actual
let costChart = null;  // Mixed bar/line: gasto + $/km ultimos 4 meses
```

### Flujo de Datos

```
Usuario → Formulario → Validacion JS → Supabase Insert/Update
                                              |
                          ┌───────────────────┤
                          ▼                   ▼
                   Insert ledger         Re-fetch datos
                   (append-only)               |
                                               ▼
                                      Re-render componentes
                                      (Smart Card, balances,
                                       historial, resumen, tanque)
```

---

## Modelo de Datos (Supabase/PostgreSQL)

### Tabla: `vehicles`

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | serial | PK auto-generada |
| `name` | text | Nombre del vehiculo ("Auto familiar") |
| `model` | text | Modelo del vehiculo ("VW Gol Trend 1.6") |
| `consumption` | numeric | Consumo aprendido en km/l (se actualiza con reconciliacion) |
| `fuel_type` | text | Tipo de combustible ("Super 95 octanos") |
| `fuel_price` | numeric | Precio promedio ponderado del litro en pesos |
| `drivers` | text[] | Array de nombres de pilotos |
| `owner_id` | uuid | FK a auth.users — dueno del vehiculo (v16.0) |
| `invite_code` | text | Codigo de invitacion unico para compartir (v16.2) |
| `current_ppp` | numeric | Precio Promedio Ponderado del combustible en tanque (v17) |
| `virtual_liters` | numeric | Litros estimados remanentes en tanque virtual (v17) |
| `correction_factor` | numeric | Multiplicador real vs teorico del consumo (default 1.0) (v17) |
| `last_full_tank_at` | timestamptz | Timestamp del ultimo tanque lleno (v17) |
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
| `occurred_at` | timestamptz | Fecha real del viaje (v14.6) |
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
| `liters_loaded` | numeric | Litros cargados (null para liquidaciones de saldo) |
| `price_per_liter` | numeric | Precio efectivo por litro (null para liquidaciones) |
| `is_full_tank` | boolean | Tanque llenado completamente |
| `invoice_type` | text | "Factura A" o "Ticket" |
| `tax_perceptions` | numeric | Percepciones fiscales |
| `discount_amount` | numeric | Descuentos aplicados |
| `note` | text | Nota opcional ("Saldado de deuda a: ..." para liquidaciones) |
| `occurred_at` | timestamptz | Fecha real del pago (v14.6) |
| `photo_url` | text | URL de foto del ticket (v15) |
| `created_at` | timestamptz | Fecha de registro |

### Tabla: `ledger` (v17+)

Libro contable inmutable. Positivo = credito, negativo = debito. Solo INSERT, nunca UPDATE ni DELETE manual.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | bigint | PK auto-generada (IDENTITY) |
| `vehicle_id` | bigint | FK a vehicles (CASCADE DELETE) |
| `driver` | text | Nombre del piloto |
| `type` | text | Tipo de entrada: `trip_cost`, `fuel_payment`, `transfer`, `tank_audit_adjustment`, `opening_balance` |
| `amount` | numeric | Monto: positivo = credito, negativo = debito |
| `ref_id` | bigint | ID del trip o payment relacionado (polimorficamente) |
| `description` | text | Descripcion legible ("Viaje 50km", "Carga de nafta $XXX") |
| `created_at` | timestamptz | Fecha de creacion |

### Tabla: `vehicle_members` (v16+)

Membresias de vehiculos — gestiona acceso multi-usuario.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `vehicle_id` | bigint | FK a vehicles (PK compuesta) |
| `user_id` | uuid | FK a auth.users (PK compuesta) |
| `role` | text | `owner` o `member` |
| `joined_at` | timestamptz | Fecha de union |

### Tabla: `profiles` (v18+)

Perfiles de usuarios autenticados. Se crea automaticamente via trigger al registrarse.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | uuid | PK, FK a auth.users (CASCADE DELETE) |
| `display_name` | text | Nombre a mostrar |
| `currency` | text | Moneda preferida (default: 'ARS') |
| `onboarding_completed` | boolean | Si completo el onboarding (default: false) |
| `created_at` | timestamptz | Fecha de creacion |

### Tabla: `vehicle_driver_mappings` (v18+)

Vincula usuarios autenticados con nombres de piloto por vehiculo (estilo Tricount).

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | bigint | PK auto-generada |
| `vehicle_id` | bigint | FK a vehicles (CASCADE DELETE) |
| `user_id` | uuid | FK a auth.users (CASCADE DELETE) |
| `driver_name` | text | Nombre del piloto reclamado por el usuario |
| `created_at` | timestamptz | Fecha de vinculacion |
| UNIQUE | (vehicle_id, user_id) | Un usuario solo puede tener un piloto por vehiculo |
| UNIQUE | (vehicle_id, driver_name) | Un nombre de piloto solo puede ser reclamado una vez |

### Tabla: `audit_logs` (v18.5+)

Registro inmutable de eventos relevantes del sistema. Se llena via triggers de PostgreSQL.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | uuid | PK (gen_random_uuid()) |
| `vehicle_id` | bigint | FK a vehicles (CASCADE DELETE) |
| `user_id` | uuid | FK a auth.users (puede ser null) |
| `action` | text | Tipo de evento: `trip_created`, `trip_deleted`, `payment_created`, `payment_deleted`, `debt_settled` |
| `description` | text | Descripcion en lenguaje natural |
| `created_at` | timestamptz | Timestamp del evento |

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

El nombre del cache (`naftometro-v18.15`) se bumpeea en cada release. Combinado con cache busting en `index.html` (`?v=18.15`), esto fuerza la actualizacion de assets en produccion.

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
| ≤480px | Moviles pequenos | Layout 1 columna, font-sizes reducidos, tabla → cards, Dynamic Island margin |
| ≤768px | Moviles/tablets | Scroll independiente por pestaña, padding compacto, payment cards en columna |
| ≥768px | Desktop/tablets grandes | Scroll natural del documento, grid 2 columnas, modales centrados, welcome modal escalado 1.25x |

### Componentes Reutilizables

- **`.glass-card`** — Tarjeta con glass morphism (blur + border)
- **`.btn` / `.btn-primary` / `.btn-danger`** — Sistema de botones
- **`.btn-icon`** — Botones solo icono con min 44x44px (accesibilidad tactil)
- **`.badge`** — Badges informativos
- **`.meta-pill`** — Pills compactos para metadata (v15.7)
- **`.vehicle-pill`** — Selector horizontal de vehiculos
- **`.toast-container`** — Notificaciones emergentes animadas (showToast())
- **`.actor-row`** — Fila de Actor List con avatar, barra proporcional y costo (v18.7)
- **`.actor-bar-fill`** — Barra de progreso con color del piloto
- **`.smart-card`** — Tarjeta de saldo personal con estados: neutral / `.clear` (te deben) / `.debt` (debes)
- **`.activity-item`** — Item del feed de actividad con icono, titulo, meta y monto
- **`.ranking-item`** — Fila del ranking de eficiencia en Dashboard (medalla + km/l)
- **`.price-trend-item`** — Item de tendencia de precio con fecha, piloto y $/l

---

## Base de Datos de Vehiculos (VEHICLE_DATABASE)

La app incluye una base de datos interna con especificaciones tecnicas de vehiculos argentinos populares:

```javascript
const VEHICLE_DATABASE = {
  'VW Gol Trend 1.6':       { tank: 55, city_km_l: 10.5, mixed_km_l: 12.5, highway_km_l: 15.0 },
  'Toyota Corolla 1.8':     { tank: 60, city_km_l: 10.8, mixed_km_l: 13.0, highway_km_l: 15.5 },
  'Ford Ka 1.5':            { tank: 48, city_km_l: 12.0, mixed_km_l: 14.0, highway_km_l: 16.5 },
  'Fiat Cronos 1.3':        { tank: 48, city_km_l: 11.5, mixed_km_l: 13.5, highway_km_l: 15.5 },
  'Fiat Cronos 1.3 Drive':  { tank: 48, city_km_l: 12.6, mixed_km_l: 14.0, highway_km_l: 15.8 },
  'Chevrolet Onix 1.0T':    { tank: 40, city_km_l: 12.5, mixed_km_l: 15.0, highway_km_l: 17.5 },
  'Renault Sandero 1.6':    { tank: 50, city_km_l: 10.0, mixed_km_l: 12.0, highway_km_l: 14.5 },
  'Toyota Hilux 2.8 TD':    { tank: 80, city_km_l:  6.5, mixed_km_l:  8.5, highway_km_l: 11.0 },
  'Ford Ranger 3.2 TD':     { tank: 80, city_km_l:  6.0, mixed_km_l:  8.0, highway_km_l: 10.5 },
  'VW Amarok 2.0 TD':       { tank: 80, city_km_l:  7.0, mixed_km_l:  9.0, highway_km_l: 11.5 },
  'Peugeot 208 1.6':        { tank: 50, city_km_l: 11.0, mixed_km_l: 13.5, highway_km_l: 16.0 },
  'VW Taos 1.4 250 TSI':    { tank: 50, city_km_l: 10.1, mixed_km_l: 13.3, highway_km_l: 16.6 },
  'Toyota Corolla 2.0 SEG': { tank: 50, city_km_l: 11.1, mixed_km_l: 14.5, highway_km_l: 17.7 },
};
```

Cada modelo tiene:
- **tank** — Capacidad del tanque en litros
- **city_km_l** — Consumo urbano (km/litro)
- **mixed_km_l** — Consumo mixto
- **highway_km_l** — Consumo en ruta

Si el modelo no esta en la DB, se usa el `vehicle.consumption` guardado manualmente.
