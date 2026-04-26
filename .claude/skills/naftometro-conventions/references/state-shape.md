# Naftometro — Forma del objeto `state`

Referencia de la estructura completa del state global. El state es un objeto plano mutable; después de mutarlo hay que llamar manualmente a las funciones de render que correspondan.

## Definición completa

```javascript
const state = {
  // === Datos cargados desde Supabase ===
  vehicles: [],          // Vehículos del usuario (membership-based, no solo owner)
  trips: [],             // Viajes del vehículo activo
  payments: [],          // Pagos del vehículo activo
  ledger: [],            // Entradas del libro contable (vehículo activo)
  driverMappings: [],    // Mapeos user_id ↔ driver_name (vehículo activo)
  auditLogs: [],         // Logs de actividad (vehículo activo)
  profile: null,         // Perfil del usuario logueado (null hasta auth)
  
  // === Datos para Dashboard global ===
  allTrips: [],          // Todos los viajes (multi-vehículo)
  allPayments: [],       // Todos los pagos (multi-vehículo)
  
  // === Estado de UI / navegación ===
  activeVehicleId: null,        // ID del vehículo seleccionado en Detail
  lastVisitedVehicleId: null,   // Para auto-select al volver
  currentTab: 'home',           // 'detail' | 'home' | 'dashboard'
  activeDetailTab: 'summary',   // 'summary' | 'vehicle' | 'finances'
  balancesExpanded: false,      // Toggle de la sección de balances
  dashboardLoaded: false,       // Cache: evitar recargar dashboard
  
  // === Estado de feeds y paginación ===
  activityItems: [],     // Items combinados (trips+payments+settlements) ordenados por fecha
  activityPage: 0,       // Página actual (0-indexed). Tamaño = ACTIVITY_PAGE_SIZE (10)
  
  // === Estado de modales / formularios en curso ===
  confirmAction: null,        // Función a ejecutar si el user confirma en confirm modal
  settlementMode: false,      // Payment modal en modo "saldar deuda" (oculta campos de nafta)
  settlementDriver: null,     // Piloto siendo liquidado en settlement
  editingPaymentId: null,     // Si != null, payment modal está editando (no creando)
  editingTripId: null,        // Si != null, trip modal está editando
  pendingPhotoFile: null,     // File pendiente de upload al confirmar el payment
  photoRemoved: false,        // Flag: el user quitó la foto de un payment existente
};
```

## Reglas de mutación

**No hay reactividad.** Cambiar `state.xxx = nuevoValor` no dispara nada solo. Hay que llamar manualmente a la función de render que corresponda:

| Cambio | Render a llamar |
|---|---|
| `state.vehicles` | `renderHome()` y/o `renderDashboard()` |
| `state.trips`, `state.payments` | `renderTripsTable()`, `renderPaymentsList()`, `buildAndRenderActivity()` |
| `state.ledger` | `renderSmartCard()`, `renderBalances()`, `buildAndRenderActivity()` |
| `state.activeVehicleId` | `selectVehicle(id)` (que internamente hace todo) |
| `state.currentTab` | `switchTab(tab)` |
| `state.activeDetailTab` | `switchDetailTab(tab)` |
| `state.profile` | `renderProfileBadge()` o equivalente |

## Patrones útiles para acceder

- **Vehículo activo**: `state.vehicles.find(v => v.id === state.activeVehicleId)`
- **Driver del usuario en vehículo X**: `state.driverMappings.find(m => m.vehicle_id === X)?.driver_name`
- **Balance de un piloto**: `state.ledger.filter(l => l.driver === D).reduce((s, l) => s + l.amount, 0)`
- **Mi balance personal**: usar `getMyDriverName(vehicleId)` para encontrar el driver, después sumar ledger

## Estado **NO** persistido en `state`

Estas cosas viven en `localStorage` (no en `state`):

- `welcome_seen` — flag de onboarding educativo (se muestra 1 vez)
- Cualquier preferencia de UI persistente
