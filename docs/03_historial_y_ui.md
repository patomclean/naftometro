# Naftometro - Historial de la Interfaz y Evolucion UI/UX

## Linea de Tiempo del Proyecto

El proyecto se desarrolla desde el 12 de febrero de 2026, con 40+ commits. La version actual es v19.2. La evolucion se organiza en fases:

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

### v15.9 — Welcome Experience
- **Modal de bienvenida**: Glass-card con titulo gradiente "Tu Socio Naftometro", subtitulo "Costos justos, cuentas claras"
- **Contenido educativo**: Explica como funciona la app, diferencia entre Auditado (pill verde) y Estimado (pill gris), y por que confiar en los numeros
- **Persistencia via localStorage**: Clave `naftometro_welcome_seen` — el modal solo aparece una vez por dispositivo
- **Boton "Empezar el viaje"**: Cierra el modal con fade-out de 300ms y guarda el estado

### v15.10 — Welcome Modal Polish
- **Desktop zoom**: En `@media (min-width: 768px)`, `.welcome-modal` con `transform: scale(1.25)` para que sea mas grande y legible en pantallas grandes
- **Mobile centering**: `margin: auto` en `.welcome-modal` para centrado vertical y horizontal correcto
- **Click-outside-to-close**: Listener en el overlay que detecta clicks fuera del modal
- **Refactor JS**: Logica de cierre extraida a `closeWelcomeModal()` reutilizable

---

## Fase 6: Multi-Tenant y Compartir (20-22 Feb 2026, v16.x)

### v16.0 — Arquitectura Multi-Tenant (SaaS)

Migracion critica que convierte la app de anonima a multi-usuario con seguridad real:

- **Tabla `vehicle_members`**: Relaciona usuarios con vehiculos con roles `owner` / `member`
- **Campo `owner_id`** en vehicles: FK a `auth.users`
- **Funciones helper SQL**:
  - `is_vehicle_member(vid)` — Verifica si el usuario logueado es miembro del vehiculo
  - `is_vehicle_owner(vid)` — Verifica si el usuario logueado es dueno del vehiculo
- **Row Level Security (RLS)** habilitado en todas las tablas
- **Trigger `on_vehicle_created`**: Al crear un vehiculo, auto-inserta al creador como `owner` en `vehicle_members`
- **Politicas RLS**:
  - `SELECT`: solo miembros del vehiculo
  - `INSERT trips/payments`: cualquier miembro
  - `UPDATE/DELETE vehicles`: solo el owner
  - `UPDATE/DELETE trips/payments`: cualquier miembro

### v16.2 — Codigos de Invitacion

- **Campo `invite_code`** en vehicles: codigo unico de 6 caracteres (XXXXXX)
- **Generacion**: `generateInviteCode(vehicleId)` genera un codigo aleatorio y lo guarda
- **Funcion SQL `join_vehicle_by_code(code)`**: RPC que valida el codigo e inserta al usuario en `vehicle_members` con rol `member`
- **UI**: Boton de compartir en la tarjeta del vehiculo, modal para unirse con codigo

---

## Fase 7: Libro Contable Inmutable (v17, Feb 2026)

### v17.0 — Ledger Schema

La mayor refactorizacion arquitectural del proyecto: reemplazar el calculo de balances en tiempo real (sumando payments y trips) por un **libro contable append-only**.

**Cambios en la DB:**
- Nueva tabla `ledger` con tipos: `trip_cost`, `fuel_payment`, `transfer`, `tank_audit_adjustment`, `opening_balance`
- Nuevas columnas en `vehicles`: `current_ppp`, `virtual_liters`, `correction_factor`, `last_full_tank_at`
- RLS: solo SELECT e INSERT (no UPDATE ni DELETE directo en ledger)

**Cambios en la app:**
- `fetchLedger(vehicleId)` — carga el libro contable del vehiculo activo
- `insertLedgerEntry(entry)` — escribe entradas inmutables
- `migrateToLedger(vehicleId, drivers)` — migra vehiculos legacy con entradas `opening_balance`
- Los balances se calculan como `SUM(ledger.amount WHERE driver = piloto)`
- El precio PPP y los litros virtuales persisten en la DB (no se recalculan en cada carga)

---

## Fase 8: Autenticacion y Perfiles (v18, Feb-Mar 2026)

### v18.0 — Auth, Profiles y Driver Mappings

- **Supabase Email Auth**: Login y registro con email/password
- **Tabla `profiles`**: Perfil del usuario (display_name, currency, onboarding_completed)
- **Trigger `on_auth_user_created`**: Crea perfil automaticamente al registrarse
- **Tabla `vehicle_driver_mappings`**: Vincula usuarios con nombres de pilotos (estilo Tricount)
  - UNIQUE (vehicle_id, user_id) — un usuario, un piloto por vehiculo
  - UNIQUE (vehicle_id, driver_name) — un piloto no puede ser reclamado dos veces
- **Avatar Claim Modal**: Al unirse a un vehiculo, popup para elegir el piloto correspondiente
- **Auth Modal**: Login/registro con email y password
- **Onboarding Modal**: Completar display_name y preferencia de moneda
- **`getMyDriverName(vehicleId)`**: Resuelve el nombre del piloto del usuario logueado

### v18.4 — Integridad de Datos

- **Cascade triggers en PostgreSQL**:
  - `on_trip_deleted` (BEFORE DELETE): elimina ledger entries con `type='trip_cost'` y `ref_id=trip.id`
  - `on_payment_deleted` (BEFORE DELETE): elimina ledger entries con `type IN ('fuel_payment','transfer')` y `ref_id=payment.id`
- **Limpieza de orphans**: DELETE en ledger de entries con ref_id que ya no existen en trips/payments
- **Debounce en botones de submit**: `btn.disabled = true` inmediatamente para evitar doble submit
- **Full state reload**: Al eliminar un trip/payment, se re-fetchea todo el estado (trips + payments + ledger) para coherencia

### v18.5 — Sub-tabs y Activity Feed

**UI:**
- La vista Detalle ahora tiene 3 sub-tabs: **Resumen** / **El Vehiculo** / **Finanzas**
- `switchDetailTab(tab)` — controla visibilidad de paneles y lazy-load del feed
- Al cambiar de vehiculo, siempre se abre en "Resumen"

**Smart Card:**
- Tarjeta personal que muestra el saldo del usuario logueado
- Estados: "Estas al dia" / "Te deben $X" / "Debes $X" con boton "Saldar"
- Se oculta si el usuario no tiene mapping de piloto

**Activity Feed (pestaña Finanzas):**
- Combina payments (cargas y liquidaciones) con audit_logs (eliminaciones y deudas saldadas)
- Paginado en chunks de 10 (ACTIVITY_PAGE_SIZE)
- Lazy: se construye la primera vez que el usuario visita la pestaña Finanzas
- Botones "Ver mas" / "Ver menos"

**Audit Logs:**
- Nueva tabla `audit_logs` con triggers automaticos en PostgreSQL
- Registra: `trip_created`, `trip_deleted`, `payment_created`, `payment_deleted`, `debt_settled`
- Fuente de datos para el Activity Feed en eventos de eliminacion

### v18.6 — Saldar Deuda Modal

- Nuevo modal "Saldar Deuda" accesible desde la Smart Card cuando el balance es negativo
- Lista los acreedores del vehiculo (pilotos con balance positivo, distintos del usuario)
- Pre-llena el monto con la deuda total del usuario
- Al confirmar: inserta 2 ledger entries (contabilidad de doble entrada)
  - Pagador: `{ type: 'transfer', amount: +monto }` — su deuda disminuye
  - Acreedor: `{ type: 'transfer', amount: -monto }` — su credito disminuye
- Boton "Ver menos" en Activity Feed (colapsa al primer ACTIVITY_PAGE_SIZE)

### v18.7 — Actor List

- Reemplaza la grilla rigida de tarjetas de resumen por un listado moderno `.actor-list`
- Cada fila `.actor-row` contiene:
  - Avatar circular con la inicial del piloto y color del PILOT_COLORS[]
  - Nombre del piloto
  - Barra horizontal proporcional al gasto (`.actor-bar-fill` con color del piloto)
  - Stats: cantidad de viajes, km totales, porcentaje del gasto total
  - Costo total en la derecha
- Toggle de expandir/colapsar la seccion de balances desde un boton con flecha
- Logica en `state.balancesExpanded` + `renderBalanceToggle()`

### v18.8 — Chart.js Visualizaciones

- **Doughnut** (`chart-km-donut`): KM por piloto del mes actual
  - Excluye pilotos con 0 km este mes
  - Ordena de menor a mayor km (sentido horario)
  - Titulo dinamico con nombre del mes
- **Mixed bar/line** (`chart-cost-bar`): Gasto y eficiencia de los ultimos 4 meses
  - Barras: gasto total de combustible (eje Y izquierdo, violeta)
  - Linea: $/km (eje Y derecho, cyan)
  - Los ejes tienen callbacks de formato: `formatCurrency(v)` y `$v/km`
- Ambos graficos se destruyen y recrean en cada `renderCharts()`
- Solo se renderizan si `window.Chart` existe (Chart.js cargado via CDN)
- Renombrado de tabs: "Historial" → "Finanzas"

### v18.9 — Refinamiento de Graficos

- Doughnut: filtro de pilotos con 0 km este mes + ordenamiento ascendente
- Ranking de pilotos: calculo de eficiencia historica `SUM(km)/SUM(liters)` por piloto
- Balances: ordenamiento de pilotos por saldo — mas deudores primero, mas acreedores ultimo
- Carga de combustible: excluye transfers y settlements del calculo de cargas reales

### v18.10 — Ordenamiento y Ranking

- **Actor List**: ordena pilotos de mayor a menor gasto (`totals[b].cost - totals[a].cost`)
  - Pilotos con costo 0 van al final
  - Preserva el indice original en `vehicle.drivers[]` para mantener la asignacion de colores
- **Mixed chart**: refactoring para calcular $/km solo con cargas reales (excluye settlements)

### v18.14 — Claim Identity Contextual

- **Modal "Claim Identity"** (`.modal-claim-identity`): se abre automaticamente al cargar un vehiculo si el usuario esta logueado pero no tiene mapping para ese vehiculo
- Lista solo los pilotos sin usuario asociado (no reclamados)
- Si todos los slots estan tomados, el modal no aparece (silencioso)
- `openClaimIdentityModal(vehicle)` vs `showAvatarClaimModal(vehicleId, drivers)`:
  - El primero es contextual (auto-popup al cambiar vehiculo)
  - El segundo es el modal legacy post-join (se muestra al unirse por codigo)
- `handleClaimIdentity()` inserta en `vehicle_driver_mappings`, re-fetchea mappings, cierra modal y activa Smart Card

### v18.15 — Hotfix: PPP corrupto y guardas defensivas del tanque

**Contexto:** un viaje de 190km mostraba un costo irreal de $56,86 y el tanque marcaba 52/50 lts. Diagnostico con datos reales: el vehiculo tenia `current_ppp = 3` (deberia ser ~$2.461/l) y `virtual_liters = 80.091` (capacidad: 50). Campos derivados corruptos; datos de origen sanos.

**Causa raiz** (rastreada via `audit_logs`): al borrar un viaje, `handleDeleteTrip()` no devolvia los litros al `virtual_liters`. Un viaje de 187km creado y borrado durante una carga masiva dejo el tanque virtual descuadrado, y la carga siguiente uso ese valor en el promedio ponderado del PPP, hundiendo el precio a ~$3.

**Cambios de codigo:**
- `handleDeleteTrip()`: restituye los litros del viaje al `virtual_liters` al borrar.
- `clampTankLiters(vehicle, liters)`: helper nuevo, limita el tanque virtual a `[0, capacidad]`. Aplicado en los 3 writes de `virtual_liters`.
- Promedio ponderado del PPP (`handlePaymentSubmit`): 3 guardas — clamp de `oldLiters`, saneo de `oldPPP` (si es < 10% del precio de carga), piso de `newPPP` (si es < 20% del precio de carga).
- `calculateTankLevel()`: cap a la capacidad (arregla el "52/50" visual).

Las guardas son inertes en operacion normal (validado con tests de logica aislada). La correccion de los datos corruptos se hizo por separado via SQL directo en Supabase.

---

## Fase 9: Rediseño UX Cargar Nafta (Junio 2026, v18.16-v18.18)

Rediseño del modal de carga al layout **"Express"** (diseño en `docs/05_modelo_financiero_v2.md` + mockups en `docs/mockups/`).

### v18.16 — Express layout
- **Monto "heroe"**: campo grande y centrado con prefijo `$`.
- **Chips de monto**: `+$10.000 / +$20.000 / +$50.000` a ancho completo (montos realistas AR 2026).
- **Tanque lleno** como toggle (con micro-explicacion) en vez de checkbox.
- **Fecha** "Hoy, HH:MM · cambiar": el `datetime-local` se despliega solo al tocar "cambiar". Helper `renderPaymentDateDisplay()`.
- **"⚙️ Mas opciones"** (`<details>`, = el ex `adjustments-details`): agrupa los campos avanzados; ahora tambien contiene la foto del ticket.
- **CTA con monto**: el boton muestra "Registrar carga · $X" (`updatePaymentCtaAmount()`).
- Se preservaron TODOS los ids del form; modo settlement intacto (4 `.settlement-hide`: chips, form-row litros, toggle, "Mas opciones").

### v18.17 — Comprobante rediseñado
- **Tipo de comprobante**: control **segmentado** `Ticket | Factura A` (maneja el checkbox oculto `#payment-factura-a` via `setInvoiceTypeUI()`).
- **Descuento / Reintegro** con **switch de unidad `$ / %`** (`getDiscountAmount()` convierte % a $).
- **Resumen de precio** rediseñado: lineas (surtidor, +percepciones, pagaste, −descuento, costo real) con el **precio efectivo destacado** abajo y subtitulo contextual.
- **🚩 Cambio de comportamiento financiero**: el descuento/reintegro ANTES se guardaba en `discount_amount` pero no afectaba nada. Ahora **baja el costo de verdad** — el neto (`monto − descuento`) se usa en el precio efectivo, en el promedio ponderado del PPP y en el credito `fuel_payment` del ledger. Solo afecta cargas CON descuento.

### v18.18 — Fix superposicion
- El CTA tenia `position: sticky` y se superponia con el contenido de "Mas opciones" al expandir. Se quito el sticky.

**Diferido a proposito:** campo **odometro** (necesita columna en `payments` = migracion) y **monto formateado en vivo**.

---

## Fase 10: Rediseño UX Registrar Viaje (Junio 2026, v18.19-v18.22)

Se aplica al modal de viaje el mismo lenguaje "Express" de Cargar Nafta (mockup aprobado en `docs/mockups/registrar_viaje_v2.html`).

### v18.19 — Express + ida/vuelta
- **Km "heroe"**: campo grande y centrado con unidad "km" (`cn-hero`).
- **Costo como preview que da confianza**: en vez de "Costo estimado: $0,00", muestra el flujo `X km → ~Y L → $Z` con la fuente (`a $P/l · consumo Mixto (13,3 km/l)`). Helper `handleTripKmInput()` reescrito.
- **Ida y vuelta** (C5): toggle que duplica los km. `getEffectiveTripKm()` (×2) se usa en el preview **y** en el guardado (km real recorrido).
- **Tipo de manejo segmentado con descripcion** (C6): Urbano (ciudad, trafico) / Mixto (combinado) / Ruta (autopista).
- **Fecha** "Hoy, HH:MM · cambiar" y **CTA con km** ("Registrar viaje · 190 km"). Helpers `friendlyDate()`, `renderTripDateDisplay()`, `updateTripCtaKm()`.

### v18.20 — Viajes frecuentes personalizados (D9)
- Chips de "viajes frecuentes" **derivados del historial de CADA piloto por separado** (los viajes de uno no le sirven a otro: la novia de Pato no es el trabajo de Marcos).
- `renderFrequentTrips(driver)`: agrupa `state.trips` del piloto por (nota normalizada + km redondeado), filtra los que se repitieron 2+ veces, ordena por frecuencia, top 4. Click en un chip autocompleta km/nota/tipo + recalcula costo.
- **D8 (odometro) descartado** por decision del usuario (mucho esfuerzo, sin valor agregado en esta seccion).

### v18.21 — Pill de piloto + emojis
- **Selector de Piloto como pill compacto** (avatar de color por `PILOT_COLORS` + nombre + caret ▾) en Registrar Viaje **y** Cargar Nafta, replicando el mockup. Va respaldado por el `<select>` nativo como overlay transparente (`.cn-driver-select`, anula el `min-height:48px` global), preservando todos los ids y listeners. Helper `renderDriverPill()`.
- **Titulos con emoji**: 🚗 Registrar viaje · ⛽ Cargar Nafta (+ modos edicion).
- **Chips frecuentes con emoji** inferido de la nota (`tripNoteEmoji()`: 🏢 trabajo/oficina, 🏠 casa, 🏖️ costa, ❤️ novia… fallback 📍), manteniendo el estilo violeta. El `data-note` queda limpio (sin emoji).

### v18.22 — Emoji del auto en el boton del Home
- El boton de accion `btn-quick-trip` mostraba "+"; se reemplaza por 🚗 para matchear el ⛽ de "Cargar Nafta".

**Proceso aprendido:** la fidelidad al mockup se valida renderizando el componente real y comparando screenshot-vs-mock (no solo la logica). Saltarse ese paso en v18.20 derivo en el reclamo del usuario que motivo v18.21.

---

## Fase 11: Modelo Financiero v2 — Pool a costo (Julio 2026, v19.0)

Reemplazo del nucleo financiero completo. Diseno, decisiones y validacion detallados en `docs/05_modelo_financiero_v2.md` (§10-11); plan de implementacion en `docs/06_plan_implementacion_modelo_v2.md`.

**Por que:** el modelo viejo (PPP con revaluo + `correction_factor`) no cerraba en suma cero (Σ balances ≠ valor fisico del tanque) y el `tank_audit_adjustment` inyectaba saldo de la nada (+$82k detectado en datos reales). Ademas, mientras se preparaba la migracion, el bug reaparecio en vivo: cargas de julio cargadas fuera de orden cronologico llevaron `correction_factor` a 4,8364, generando viajes de ~$900/km (36 km = $32.547).

**v19.0 — Pool a costo (WAC):**
- `vehicles.pool_litros` + `pool_costo` reemplazan a `current_ppp`/`virtual_liters`/`correction_factor` (deprecados, no leidos ni escritos). Precio de viaje = `pool_costo / pool_litros` — promedio ponderado a costo, metodo contable estandar (IFRS IAS2, SAP moving average).
- `vehicles.km_l_aprendido`: rinde real con **guarda fisica de plausibilidad (4-25 km/l)** — la guarda que faltaba y que hubiera evitado el 4,83.
- `performTankAudit()` reescrita: reconciliacion **suma cero** — el faltante de un ciclo se reparte entre pilotos por promedio ponderado de km (uso), y se descuenta del pool — ya no inventa plata.
- Un viaje cobrado **queda fijo** — `recalculateTrips()` y `recalculateGlobalConsumption()` deprecadas (no-op).
- `handleDeleteTrip`/`handleDeletePayment` revierten litros Y costo del pool (antes solo litros).
- 27 tests unitarios del motor (`sim/pool_engine_test.js`): blend a costo, suma cero, borrados, settlement, 500 operaciones aleatorias sin desvio.

**Migracion (Taos, ancla: tanque lleno 30-jun-2026):** saldos recalculados con el modelo "plata + km" e insertados como `ledger.type='migration_v2'` (append-only respetado). Validado en produccion: `SUM(ledger.amount) = pool_costo = $76.499,00` exacto.

| Piloto | Saldo viejo (no cerraba) | Saldo v19.0 |
|---|---:|---:|
| PAPÁ | +$137.888 | +$182.797,76 |
| Pato | +$122.705 | +$93.090,82 |
| Belu | −$12.562 | +$56.062,88 |
| Rafa | −$72.199 | −$38.110,49 |
| Feli | −$57.545 | −$77.656,00 |
| Marcos | −$105.142 | −$139.685,97 |

**Proceso:** backup completo antes de tocar nada (`backup/2026-06-17_taos_backup.sql`); simulacro read-only (`sim/pool_sim.js`) para validar el modelo contra datos reales ANTES de escribir codigo; despliegue en orden estricto schema → datos → codigo; comunicacion al grupo en lenguaje simple (sin formulas) explicando el cambio de saldos y por que nadie pierde plata.

**v19.1 — Ediciones y limpieza conservan la invariante (Julio 2026):**

Una revision post-deploy encontro 3 escenarios que rompian `SUM(ledger) = pool_costo`. Se corrigieron adaptandolos al modelo pool bajo un principio unico: **toda edicion = REVERSION + NUEVO CARGO** (el ledger es append-only; las entradas compensatorias llevan el mismo `ref_id` que el original, asi el cascade trigger las borra juntas y su suma neta es el valor final del registro — borrar despues de editar sigue consistente).

- **Limpiar viajes**: restituye Σlitros y Σcosto de todos los viajes al pool (antes rompia la invariante por el total historico) + refresca ledger/vehiculos post-cascade.
- **Editar carga**: par `fuel_payment` (−neto viejo al piloto viejo, +neto nuevo al nuevo) + `applyPoolDelta` del delta. Antes editar el monto y borrar la carga descuadraba el pool.
- **Editar viaje**: cambio de piloto solo → mueve el debito con costo FIJO (pool intacto); cambio de km/tipo de manejo → devuelve litros/costo al pool y re-precia al precio del pool post-reversion. Solo metadatos (nota/fecha) → sin entradas.
- Validado con `sim/edit_flows_test.js`: 20 asserts + fuzz de 300 operaciones aleatorias mezclando crear/editar/borrar/limpiar — desvio final $0,00. Commit `c2371bb`.

**v19.2 — UI alineada al modelo pool (Julio 2026):**

Limpieza de los restos del modelo viejo que confundian (sin impacto financiero):
- Badge "Estimado" en viajes → **"Pool"**, y su popup ya no promete "se ajustara en el proximo tanque lleno" (falso en v19): explica que el costo se cobro al precio promedio del tanque y queda fijo. El ✓ verde se conserva para viajes reconciliados legacy.
- Toast "Tanque virtual vacio, usando precio de referencia" → "Sin litros registrados en el tanque: se usa el precio de la ultima carga" (dispara sobre `pool_litros`, no sobre el tanque virtual legacy).
- **Home cards** ahora muestran el mismo precio/l, km/l y $/km que el Detail: precio del pool + `km_l_aprendido` (antes usaban ultima carga + consumo teorico — dos numeros distintos para el mismo auto segun la vista).
- Codigo muerto eliminado: `calculateCost()` (PPP + correction_factor) y `calculateWeightedPrice()` (blend PPP) ya no tenian callers.
- Skills de `.claude/skills/` actualizadas al modelo v2 (la de ledger-rules todavia documentaba el PPP como vigente).

---

## Problemas de iOS/Safari Resueltos

### 1. Texto Vertical en Fechas (v15.3 → v15.4)

**Problema:** En Safari iOS, las fechas se partian a mitad de caracter, mostrando texto apilado verticalmente.
**Causa:** `word-break: break-word` en contenedores estrechos rompia dentro de palabras.
**Solucion:** Cambiar a `overflow-wrap: break-word`, que solo rompe entre palabras.

### 2. Scroll Reset entre Tabs (v15.3 → v15.8)

**Problema:** Al hacer swipe entre pestañas, el usuario llegaba al fondo de la nueva vista en vez del tope.

| Version | Enfoque | Resultado |
|---------|---------|-----------|
| v15.3 | `setTimeout(400)` con `scrollTop = 0` | Funcionaba pero delay notable |
| v15.4 | `requestAnimationFrame` | Fallo: iOS no ejecuta rAF durante swipe |
| v15.5 | `IntersectionObserver` con `threshold: 0.5` | Inconsistente en iOS con inercia |
| v15.6 | `setTimeout(150)` + `scrollTop = 0` | Mejor, pero inercia de iOS a veces ganaba |
| v15.7 | `setTimeout(150)` + `scrollTo({top:0, behavior:'instant'})` | **Solucion final** |
| v15.8 | Solo en mobile (reglas movidas a media query 768px) | Desktop usa scroll natural |

**Solucion final:** `scrollTo({top: 0, behavior: 'instant'})` en `.view-content` con delay de 150ms post-transicion. `behavior: 'instant'` cancela la inercia de iOS. En desktop, el scroll es natural del documento.

### 3. Safari Ignora flex-basis: 100% (v15.5 → v15.6)

**Problema:** `.payment-meta` con `flex-basis: 100%` no ocupaba toda la linea en Safari iOS.
**Intentos fallidos:** `flex-basis: 100% !important`, `min-width: 100%` — Safari los ignoraba.
**Solucion (v15.6):** Reemplazar Flexbox por CSS Grid:
```css
.payment-item { display: grid; grid-template-columns: auto 1fr auto; }
.payment-meta { grid-column: 1 / -1; }
```
**Evolucion (v15.7):** Reestructurar a layout vertical Header/Body/Footer, eliminando el problema de raiz.

### 4. Scroll Independiente por Pestaña (v15.6 → v15.8)

**Problema:** En iOS, al navegar entre tabs, la posicion de scroll se compartia entre vistas.
**Solucion mobile:** `height: 100dvh; overflow: hidden` en `.view` + `overflow-y: auto; -webkit-overflow-scrolling: touch` en `.view-content`.
**Regresion desktop (v15.8):** Generaba scroll interno. Solución: mover reglas a `@media (max-width: 768px)`.

### 5. Cache No Se Actualiza en Produccion (v15.51)

**Causa:** Service Worker cache-first servia assets del cache viejo indefinidamente post-deploy.
**Solucion multi-capa:** Cache busting con query strings + bump del `CACHE_NAME` + `skipWaiting()` + `clients.claim()`.

---

## Estructura Visual Actual (v19.0)

### Vista Detalle — Sub-tabs

```
┌──────────────────────────────────────────┐
│ [Vehiculo Pills scrollable horizontal]   │
├──────────────────────────────────────────┤
│ [Nombre Vehiculo] [Modelo] [Consumo...]  │  ← Vehicle Info Card
├──────────────────────────────────────────┤
│ [Resumen] [El Vehiculo] [Finanzas]       │  ← Sub-tabs
│ ─────────────────────────────────────── │
│ TAB RESUMEN:                             │
│   Smart Card (saldo personal)            │
│   Tank Indicator (nivel + precio)        │
│   Actor List (pilotos con barras)        │
│   Graficos Chart.js (doughnut + mixto)  │
│ TAB EL VEHICULO:                         │
│   Info tecnica (consumos, capacidad)     │
│   Historial de viajes con badges         │
│ TAB FINANZAS:                            │
│   Activity Feed paginado                 │
│   Balances por piloto (expandibles)      │
└──────────────────────────────────────────┘
```

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
| [delete]                                           |  ← Boton directo
+--------------------------------------------------+
```

### Actor Row (`.actor-row`)

```
+--------------------------------------------------+
| [P]   Piloto Name                      $XX,XXX.XX |
|       [████████████████░░░░░░] 75%               |
|       5 viajes · 850 km · 75%                    |
+--------------------------------------------------+
```

### Smart Card (`.smart-card`)

```
Estado neutral:  [ ✓ Estas al dia     $0           ]
Estado positivo: [   Te deben plata   +$20,000     ] ← clase .clear (borde verde)
Estado negativo: [   Debes plata      -$15,000     ] ← clase .debt (borde rojo)
                                    [Btn: Saldar]
```

### Sistema de 3 Vistas

```
[Vehiculos/Detalle]  [Home]              [Dashboard]
+-----------+   +-----------+       +-----------+
| Pills     |   | Header    |       | Filter    |
| Info Card |   | Registrar |       | Stats     |
| Sub-tabs  |   | Agregar   |       | Monthly   |
|  Resumen  |   | Vehicles  |       | Per-Car   |
|  Vehiculo |   | Grid      |       | Activity  |
|  Finanzas |   |           |       | Ranking   |
+-----------+   +-----------+       +-----------+
  ← swipe →       DEFAULT             swipe →
```
