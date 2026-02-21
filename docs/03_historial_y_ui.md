# Naftometro - Historial de la Interfaz y Evolucion UI/UX

## Linea de Tiempo del Proyecto

El proyecto se desarrollo entre el 12 y el 20 de febrero de 2026, con 39 commits en total. La evolucion se organiza en fases:

---

## Fase 1: Fundacion (12-13 Feb 2026)

### Commit inicial
- Calculadora basica de costos de combustible entre hermanos
- Formulario simple con vehiculos y conductores

### Navegacion e infraestructura
- Sistema de Home/Detalle con vehicle cards
- PWA: Service Worker, manifest, iconos SVG
- Swipe gestures para navegacion entre vistas
- Bottom navigation con 3 tabs (Vehiculos, Home, Stats)
- Vehicle pills (selector horizontal scrollable)

---

## Fase 2: Funcionalidades Core (13-16 Feb 2026)

### Sistema P2P de clearing
- Algoritmo greedy para calcular transferencias minimas entre pilotos
- Boton de "Saldar deuda" por piloto

### Modulo fiscal (Factura A)
- Desglose de IVA, IDC y percepciones
- Calculo de precio efectivo (neto de percepciones)

### UX rebrand a "Piloto"
- Terminologia: conductores → pilotos
- Smart forms con autocompletado
- Per-pilot clearing (liquidar por piloto individual)

### Precision en cargas
- Litros cargados, precio por litro
- Deteccion de tanque lleno
- Indicador de tanque virtual (v11)
- Precio ponderado del combustible

---

## Fase 3: Inteligencia (17 Feb 2026, v12-v14)

### v12 — Edicion Universal
- Boton de editar en pagos y viajes
- Pre-carga de datos en modales de edicion

### v13 — Base de Datos de Vehiculos
- Database interno con specs de modelos argentinos
- Selector de tipo de manejo: Urbano, Mixto, Ruta
- Capacidad real del tanque por modelo

### v14.1 — Reconciliacion de Tanque
- Sistema de auditoria automatica al llenar el tanque
- Ajuste de viajes con factor de desviacion real vs estimado
- Campos `is_reconciled`, `reconciled_at`, `original_consumption`, `real_consumption`

### v14.2 — Badge de Reconciliacion
- Badge visual con checkmark para viajes verificados
- Popup de detalle al tocar el badge

### v14.3-v14.4 — Fixes de Reconciliacion
- Correccion del factor de desviacion por tipo de manejo
- Split de updates en Supabase para evitar errores silenciosos

### v14.5 — Memoria Reconstructiva
- `recalculateGlobalConsumption()`: aprende de todos los ciclos historicos
- Actualiza `vehicle.consumption` con promedio real acumulado

### v14.6 — Dimension Temporal
- Campo `occurred_at` para registrar fecha real (no solo fecha de carga)
- Sincronizacion del tanque fisico con timeline cronologico

### v14.7 — Limpieza Visual
- Centro de acciones rediseñado con grid
- Mejoras generales de UX

### v14.8 — Justicia de Precios
- Modal de viaje mejorado
- Acordeon nativo (`<details>/<summary>`) para ajustes de precio
- Resumen dinamico de precios (pagado, surtidor, efectivo)

---

## Fase 4: Evidencia Visual (18 Feb 2026, v15.0-v15.1)

### v15.0 — Modulo de Evidencia Fotografica
- **Captura de foto**: Input de camara en el modal de pago
- **Resize client-side**: Canvas resize a max 1200px, JPEG 80%
- **Upload**: Supabase Storage bucket `fuel-tickets`
- **Preview**: Thumbnail en el modal antes de guardar
- **Viewer**: Modal de foto a pantalla completa con boton de cierre
- **Icono de camara**: En el historial de pagos, indica que tiene foto
- **"Ver Ticket Original"**: Boton en el popup de reconciliacion para ver el ticket

### v15.1 — Transparencia de Capital
- **`isTripVerified()`**: Verificacion estricta (reconciliado + tanque lleno posterior)
- **Badge "Estimado"**: Clickeable, muestra popup explicando que el costo es aproximado
- **Modulo Tank Capital**: Muestra valor monetario del combustible en el tanque y quien lo pago

---

## Fase 5: Pulido Mobile (19 Feb 2026, v15.2-v15.8)

Esta fase se enfoco en resolver problemas reales detectados en QA con iPhone 15.

### v15.2 — Flujo de Entrada Unificado
- "Agregar viaje" renombrado a "Registrar viaje"
- Modal selector de vehiculo: aparece cuando hay multiples vehiculos
- Flujo inteligente: 0 vehiculos → toast, 1 → auto-select, >1 → selector modal
- Recuerda ultimo vehiculo visitado (`lastVisitedVehicleId`)

### v15.3 — Adaptabilidad Mobile
- **Media query 768px**: Payment cards wrapping, badge spacing, glass-card padding
- **Media query 480px**: Fonts mas chicos, margins compactos, trip table → cards
- **Scroll-to-top**: `setTimeout(400)` post-transicion de tab

### v15.4 — iPhone Polish
- **Fix de fechas**: `word-break: break-word` rompia fechas a mitad de caracter → cambiado a `overflow-wrap: break-word`
- **Badges mejorados**: Pill-shaped con colores de fondo (verde reconciliado, gris estimado)
- **Balances compactos**: Seccion de expand mas limpia
- **Dynamic Island**: `margin-top: 0.5rem` en 480px para el header
- **Scroll reset**: rAF (requestAnimationFrame) en vez de setTimeout

### v15.5 — QA iPhone 15
- **Labels del vehiculo**: "Tipo de combustible" → "Combustible habitual", "Precio del litro" → "Precio de referencia - Opcional"
- **Safari flex-basis bug**: `flex-basis: 100% !important` y `min-width: 100%` para `.payment-meta`
- **Autoclose popups**: Los popups de breakdown se cierran al abrir modales o photo viewer
- **IntersectionObserver**: Reemplazo del scroll reset con observer que detecta vistas visibles

### v15.51 — Cache Busting Agresivo
- **Problema**: 2+ horas despues del push, cambios no visibles en produccion
- **Causa raiz**: Service Worker cache-first servia assets viejos del cache
- **Solucion**: Query strings en assets (`style.css?v=15.51`, `app.js?v=15.51`)
- **CSS `!important`**: Forzar reglas que Safari ignoraba
- **Console.log probe**: `console.log("Naftometro v15.51")` para verificar version en produccion

### v15.6 — iOS WebKit Deep Fixes
- **Viewport lockdown**: `maximum-scale=1, user-scalable=no` para evitar zoom accidental
- **Safari grid fix**: `.payment-item` en 768px cambiado de Flexbox a CSS Grid:
  - `display: grid; grid-template-columns: auto 1fr auto`
  - `.payment-meta` con `grid-column: 1 / -1; order: -1` (linea completa, arriba)
  - Esto resolvio el bug de Safari donde `flex-basis: 100%` no funcionaba
- **Scroll independiente**: `.view { height: 100vh; overflow: hidden }` + `.view-content { overflow-y: auto; -webkit-overflow-scrolling: touch }`
  - Cada pestaña tiene su propio scroll, evitando que el swipe deje al usuario en el fondo de otra vista
- **Scroll reset**: `setTimeout(150)` targeting `.view-content` en vez de IntersectionObserver

### v15.7 — Tarjetas de Carga Profesionales
- **Reestructuracion a 3 capas**: Layout vertical con Header, Body y Footer
  - **Header**: Piloto (izquierda, con dot de color) + Monto (derecha, `font-size: 1rem`, bold)
  - **Body**: Metadata como pills compactos (`<span class="meta-pill">`) en fila wrappeable
  - **Footer**: Botones de accion (foto, info, editar, borrar) con separador `border-top` sutil
- **Meta pills**: Badges redondeados para fecha, litros, precio/l, nota
- **Pill "Tanque lleno"**: Clase `.pill-full` con fondo verde
- **`.payment-item`**: Cambiado de `flex-direction: row` a `flex-direction: column`
- **Scroll inertia fix**: `scrollTo({top: 0, behavior: 'instant'})` para vencer inercia de iOS

### v15.8 — Scroll Adaptativo
- **Problema**: Las reglas de scroll independiente (v15.6) generaban barras de scroll internas en desktop
- **Solucion**: Mover reglas iOS a `@media (max-width: 768px)`:
  - **Desktop (>768px)**: `.view { height: auto; overflow: visible }` — scroll natural del documento
  - **Mobile (<=768px)**: `.view { height: 100dvh; overflow: hidden }` + `.view-content { overflow-y: auto }` — scroll independiente por pestaña
- Dashboard y Vehiculos fluyen naturalmente en desktop sin contenido cortado

---

## Problemas de iOS/Safari Resueltos

### 1. Texto Vertical en Fechas (v15.3 → v15.4)

**Problema:** En Safari iOS, las fechas se partian a mitad de caracter, mostrando texto apilado verticalmente.

**Causa:** `word-break: break-word` en contenedores estrechos rompia dentro de palabras.

**Solucion:** Cambiar a `overflow-wrap: break-word`, que solo rompe entre palabras.

### 2. Scroll Reset entre Tabs (v15.3 → v15.4 → v15.5 → v15.6 → v15.7 → v15.8)

**Problema:** Al hacer swipe entre pestañas, el usuario llegaba al fondo de la nueva vista en vez del tope.

**Iteraciones de solucion:**

| Version | Enfoque | Resultado |
|---------|---------|-----------|
| v15.3 | `setTimeout(400)` con `scrollTop = 0` | Funcionaba pero delay notable |
| v15.4 | `requestAnimationFrame` | Fallo: iOS no ejecuta rAF durante swipe |
| v15.5 | `IntersectionObserver` con `threshold: 0.5` | Inconsistente en iOS con inercia |
| v15.6 | `setTimeout(150)` + `scrollTop = 0` | Mejor, pero inercia de iOS a veces ganaba |
| v15.7 | `setTimeout(150)` + `scrollTo({top:0, behavior:'instant'})` | **Solucion final** — `behavior: 'instant'` cancela la inercia |
| v15.8 | Solo en mobile (reglas movidas a media query 768px) | Desktop usa scroll natural |

**Solucion final:** `scrollTo({top: 0, behavior: 'instant'})` en `.view-content` con delay de 150ms post-transicion. En desktop, el scroll es natural del documento.

### 3. Safari Ignora flex-basis: 100% (v15.5 → v15.6)

**Problema:** `.payment-meta` con `flex-basis: 100%` no ocupaba toda la linea en Safari iOS, aplastando el texto verticalmente.

**Intentos fallidos:**
- `flex-basis: 100% !important` — Safari lo ignoraba
- `min-width: 100%` — sin efecto

**Solucion (v15.6):** Reemplazar Flexbox por CSS Grid:
```css
.payment-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
}
.payment-meta {
  grid-column: 1 / -1;  /* Ocupa toda la fila */
}
```

**Evolucion posterior (v15.7):** Reestructurar completamente a layout vertical con Header/Body/Footer, eliminando el problema de raiz.

### 4. Scroll Independiente por Pestaña (v15.6 → v15.8)

**Problema:** En iOS, al navegar entre tabs, la posicion de scroll se compartia entre vistas.

**Solucion (v15.6):**
```css
.view { height: 100dvh; overflow: hidden; }
.view-content { height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch; }
```

**Regresion en desktop (v15.8):** Estas reglas generaban scroll interno con barras visibles en pantallas grandes.

**Solucion adaptativa (v15.8):** Mover las reglas a `@media (max-width: 768px)`. Desktop usa `height: auto; overflow: visible`.

### 5. Cache No Se Actualiza en Produccion (v15.51)

**Problema:** Despues de push a GitHub/Vercel, los cambios no aparecian en produccion por mas de 2 horas.

**Causa:** El Service Worker con estrategia cache-first servia assets del cache viejo indefinidamente.

**Solucion multi-capa:**
1. Cache busting con query strings en `index.html` (`style.css?v=15.51`)
2. Bump del `CACHE_NAME` en `sw.js` para forzar reinstalacion
3. `skipWaiting()` + `clients.claim()` para activacion inmediata
4. Console.log con version para verificar en produccion

---

## Resumen de la Estructura Visual Actual (v15.8)

### Tarjeta de Pago (`.payment-item`)

```
+--------------------------------------------------+
| [dot] Piloto Name        FACTURA A    $XX,XXX.XX  |  ← Header
|                                                    |
| [Fecha] [25 lts] [$1,200/l] [Tanque lleno]        |  ← Body (pills)
|                                                    |
| ────────────────────────────────────────────────── |  ← Separador
| [camera] [info] [edit] [delete]                    |  ← Footer (acciones)
+--------------------------------------------------+
```

### Tarjeta de Liquidacion (`.payment-item-settlement`)

```
+--------------------------------------------------+
| [billete] Piloto Name                  $XX,XXX.XX  |  ← Header (violeta)
|                                                    |
| [Fecha] [Saldado de deuda a: X]                   |  ← Body (pills)
|                                                    |
| [delete]                                           |  ← Sin footer, boton directo
+--------------------------------------------------+
```

### Sistema de 3 Vistas

```
[Vehiculos]         [Home]              [Dashboard]
+-----------+   +-----------+       +-----------+
| Pills     |   | Header    |       | Filter    |
| Vehicle   |   | Registrar |       | Stats     |
| Info Card |   | Agregar   |       | Monthly   |
| Actions   |   | Vehicles  |       | Per-Car   |
| Summary   |   | Grid      |       | Activity  |
| Balances  |   |           |       | Ranking   |
| Payments  |   |           |       | Price     |
| Trips     |   |           |       | Trend     |
+-----------+   +-----------+       +-----------+
  ← swipe →       DEFAULT             ← swipe →
```
