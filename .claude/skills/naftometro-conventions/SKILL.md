---
name: naftometro-conventions
description: Project conventions, architecture, and codebase navigation for Naftometro — a vanilla JS PWA for sharing fuel costs between drivers, deployed on Vercel with a Supabase backend. Use this skill whenever the user mentions Naftometro, naftometro.vercel.app, the patomclean/naftometro repo, files like app.js / index.html / style.css / sw.js in this project, or any task involving the fuel calculator app (adding features, fixing bugs, refactoring, deploying). Also use it for tasks involving "el carro compartido", "split de combustible", "cargas de nafta", "viajes de pilotos", PPP (Precio Promedio Ponderado), tank audit, settle debt, or driver mappings — these are all Naftometro concepts. Loading this skill prevents wrong assumptions about the stack (NO frameworks, NO bundler, NO build step) and saves re-explaining the project context every session.
metadata:
  version: 1.0.0
---

# Naftometro — Convenciones del Proyecto

Naftometro es una PWA vanilla (HTML + CSS + JS) sobre Supabase, sin frameworks ni build tools. Esta skill captura las convenciones del codebase para que cualquier cambio sea consistente con lo existente.

## Stack confirmado (no asumir otra cosa)

- **Frontend**: HTML5 + CSS3 + Vanilla JS (ES2020+). Sin React, Vue, Svelte, etc. Sin Tailwind.
- **Backend**: Supabase (PostgreSQL + Auth + Storage + RLS). Anon key expuesta en `app.js` (es pública, está bien).
- **Charts**: Chart.js v4.4.0 vía CDN
- **Deploy**: Vercel auto-deploy desde rama `main` de `github.com/patomclean/naftometro`
- **Idioma**: español rioplatense (es-AR). Todos los textos visibles van en español.
- **PWA**: Service Worker `sw.js` (cache-first estáticos, network-first Supabase) + `manifest.json`

**No existe**: `package.json`, `node_modules`, build step, transpilación, TypeScript, tests, linter, CI.

## Estructura física de archivos

```
fuel-calculator/
├── index.html              ~750 líneas, contiene los 12 modales
├── app.js                  ~4.300 líneas (toda la lógica)
├── style.css               ~2.100 líneas
├── sw.js                   Service Worker
├── manifest.json
├── vercel.json             headers de cache
├── icons/                  SVG icons
└── *.sql                   migraciones Supabase (vXX.Y_descripcion.sql)
```

Todo el JS de la app está en un solo archivo. Cuando edites, buscá la sección correcta antes — no asumas que hay módulos separados.

## El objeto `state` global

El estado vive en un objeto mutable plano (sin Redux, sin observers). Después de mutarlo, hay que llamar manualmente a las funciones de render. Las claves principales son:

`vehicles`, `activeVehicleId`, `currentTab` (`'detail'|'home'|'dashboard'`), `activeDetailTab` (`'summary'|'vehicle'|'finances'`), `trips`, `payments`, `ledger`, `driverMappings`, `auditLogs`, `profile`, `editingPaymentId`, `editingTripId`, `pendingPhotoFile`.

Para detalle completo del state, ver `references/state-shape.md` cuando lo necesites.

## Las 3 vistas principales

```
[Detail (vista 0)]  ← swipe →  [Home (vista 1)]  ← swipe →  [Dashboard (vista 2)]
```

Container con `width: 300%` y `display: flex`, navegación por `translateX()`. Bottom nav con 3 tabs. La función `switchTab(tabName)` es el punto de entrada.

Dentro de Detail hay 3 sub-tabs: **Resumen** (smart card + charts), **El Vehículo** (cargas + viajes), **Finanzas** (balances + activity feed). La función es `switchDetailTab(tab)`.

## Los 3 flujos de negocio (CRÍTICO no confundir)

Confundir estos 3 flujos es el error más frecuente. Cada uno toca tablas distintas y resuelve un problema distinto:

| Flujo | Problema | Función | Tabla principal | Reversible |
|---|---|---|---|---|
| **A: Reconciliación** | Costos teóricos vs reales | `performTankAudit()` | `trips` (UPDATE) + `ledger` (`tank_audit_adjustment`) | NO |
| **B: Settlement** | Saldar deuda entre pilotos | `handleSettleDebtSubmit()` | `ledger` (2x `transfer`) | NO |
| **C: Identity Claim** | Vincular usuario ↔ piloto | `handleClaimIdentity()` | `vehicle_driver_mappings` (INSERT) | SÍ |

Para reglas estrictas del ledger y los flujos, ver la skill `naftometro-ledger-rules`.

## Patrones de código a respetar

### Queries a Supabase
Patrón estándar:
```javascript
const { data, error } = await supabase
  .from('trips')
  .select('*')
  .eq('vehicle_id', vehicleId)
  .order('occurred_at', { ascending: false });
```
RPC para funciones SECURITY DEFINER:
```javascript
await supabase.rpc('join_vehicle_by_code', { code });
```

### Modales
Mostrar/ocultar con `toggleHidden(element)` o agregando/quitando clase `.hidden`. Cada modal nuevo tiene:
1. Markup en `index.html` con id `<feature>-modal` y clase `modal-overlay hidden`
2. Variables DOM cacheadas al inicio de `app.js` (sección de `getElementById`)
3. Listeners en `setupEventListeners()`
4. Funciones `openXxxModal()` y `closeXxxModal()`

### Renderizado
No hay reactividad. Después de mutar `state.xxx`, llamá explícitamente a la función de render correspondiente (`renderHome()`, `renderSmartCard()`, `buildAndRenderActivity()`, etc.).

### Toast
`showToast(mensaje, type)` donde `type` es `'success'` o `'error'`. Auto-dismiss a 3s.

### Formato de moneda
`formatCurrency(n)` usa locale `'es-AR'`. No hagas `n.toFixed(2)` directo en UI.

## Sistema de diseño (CSS)

Variables clave (no inventar colores nuevos sin razón):
- `--color-primary: #7c5cfc` (violeta)
- `--color-success: #22c55e`, `--color-danger: #ef4444`
- `--glass-bg`, `--glass-border`, `--glass-blur: 12px` (glass morphism)
- `PILOT_COLORS` (en JS): array de 6 colores asignados por índice de `vehicle.drivers[]`. **No cambies el orden.**

Componentes reutilizables: `.glass-card`, `.btn` / `.btn-primary` / `.btn-danger`, `.btn-icon` (mín 44x44 para touch), `.badge`, `.meta-pill`, `.smart-card`, `.actor-row`, `.activity-item`, `.toast-container`.

**Mobile-first**: probar siempre en iOS Safari. Las reglas de scroll independiente solo aplican a `≤768px`. Para fixes acumulados de iOS/Safari, ver `references/ios-gotchas.md`.

## Checklist obligatorio de deploy

Cualquier cambio que toque código requiere bumpear la versión **en 3 lugares**:

1. `console.log` en `app.js` (header del archivo)
2. `?v=X.Y` en los 2 tags `<script>` y `<link>` de `index.html`
3. `CACHE_NAME = 'naftometro-vX.Y'` en `sw.js`

Si no se bumpea, los usuarios siguen viendo la versión vieja por el Service Worker cacheando. Para checklist completo, ver `references/deploy-checklist.md`.

## Convenciones de naming

- **Archivos SQL**: `vXX.Y_descripcion_corta.sql` (ej: `v18.5_audit_logs.sql`)
- **Funciones JS**: camelCase (`handleTripSubmit`, `renderSmartCard`)
- **IDs HTML**: kebab-case (`btn-add-trip`, `payment-modal`)
- **Clases CSS**: kebab-case (`.glass-card`, `.smart-card-amount`)
- **Tablas SQL**: snake_case (`vehicle_members`, `audit_logs`)

## Antipatrones a evitar

- ❌ Sugerir agregar React/Vue/cualquier framework
- ❌ Sugerir agregar bundler (Webpack/Vite/esbuild) o transpilación
- ❌ Sugerir Tailwind o cambio de sistema CSS
- ❌ Crear archivos JS separados o "componentes" (todo va en `app.js`)
- ❌ Asumir que existe `package.json` o tests
- ❌ Olvidar bumpear versión en los 3 lugares
- ❌ Modificar el orden de `PILOT_COLORS` (rompe asignación visual de colores)
- ❌ Texto en inglés en la UI (la app es es-AR)
- ❌ Tocar el ledger con UPDATE (es append-only por diseño — ver skill `naftometro-ledger-rules`)

## Referencias adicionales en esta skill

- `references/deploy-checklist.md` — pasos detallados pre/post deploy
- `references/ios-gotchas.md` — fixes acumulados de iOS/Safari (no repetir bugs ya resueltos)
- `references/state-shape.md` — forma completa del objeto `state` con tipos
