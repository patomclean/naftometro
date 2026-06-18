# Plan de Implementación — Modelo Financiero v2 (Pool a costo)

> **Estado:** plan para revisión, NO ejecutado. Alcance: **núcleo financiero** (pool + suma cero). Decisiones en `docs/05` §10. Backup previo: `backup/2026-06-17_taos_backup.sql`.
> **Regla:** el código del modelo nuevo y la migración de datos se despliegan **juntos** (el código nuevo sobre datos viejos rompería balances). Hasta entonces, nada toca producción.

---

## 1. Cambios de esquema (SQL)

**`vehicles`** — agregar las 2 columnas del pool (única fuente de verdad):
- `pool_litros numeric` — litros actualmente en el tanque.
- `pool_costo numeric` — costo a valor real de esos litros.
- Se **deprecan** (se dejan pero no se leen ni escriben): `current_ppp`, `virtual_liters`, `correction_factor`. No se borran para no romper nada legacy.

**`ledger`** — nuevo tipo para el restateo:
- Agregar `'migration_v2'` al CHECK de `type` (migración SQL, ver skill `naftometro-sql-migrations`).
- Es el delta por piloto que lleva del saldo viejo al saldo correcto nuevo. Append-only respetado: NO se borra ni edita el ledger viejo.

**Diferido:** `odometer` en `payments` (fase 2, no en este alcance).

---

## 2. Cambios de código (`app.js`)

| Función | Cambio |
|---|---|
| `getPoolPrice(vehicle)` (NUEVA) | `pool_costo / pool_litros` con guarda (si `pool_litros<=0` → último precio de carga). Reemplaza a `getLatestFuelPrice` como fuente de precio. |
| `handlePaymentSubmit` | Quitar el blend PPP viejo (líneas ~3216-3260). Nuevo: `pool_litros += litros`; `pool_costo += (amount − descuento)`; ledger `fuel_payment = +(amount − descuento)` (igual que hoy). Si `is_full_tank` → `performTankAudit()` (reescrita). |
| `handleTripSubmit` | `liters = km / km_l_aprendido`; `cost = liters × getPoolPrice(vehicle)`; `pool_litros −= liters`; `pool_costo −= cost`; ledger `trip_cost = −cost` (igual). Sin `correction_factor`. |
| `performTankAudit` | **Reescribir suma cero:** al cerrar ciclo (tanque lleno), reanclar `pool_litros = capacidad`; el costo del gap se redistribuye entre los pilotos del ciclo por km (débito/crédito) **y se descuenta del `pool_costo`** → mantiene `Σ balances = pool_costo`. El `tank_audit_adjustment` deja de inyectar saldo. Actualizar `km_l_aprendido` (promedio móvil del rinde de ciclos cerrados). |
| `handleDeleteTrip` | Al borrar un viaje, **revertir el pool**: `pool_litros += liters`; `pool_costo += cost`. (El cascade trigger ya borra la entrada `trip_cost`.) |
| `recalculateTrips` | **Eliminar/desactivar** — re-preciaba viajes pasados (fuente de desconfianza). En el modelo nuevo, un viaje cobrado queda fijo. |
| `calculateTankLevel` / tank indicator | Leer `pool_litros` directo (ya no recalcular desde eventos). |
| Lectura de balances | Sin cambios: sigue siendo `SUM(ledger.amount)`. La invariante `Σ = pool_costo` se cumple sola. |

---

## 3. Migración de datos (una sola vez, en el próximo tanque lleno)

Se dispara cuando el auto vuelve y se carga a tanque lleno (da el ancla limpia).

1. **Backup** del estado del momento (re-correr el dump, hecho una vez ya).
2. **Ancla:** con el llenado a tope, `pool_litros = capacidad (50)`. `pool_costo` = valor a costo de esos litros (precio promedio del pool calculado por el simulador hasta ese punto).
3. **Saldos nuevos:** correr el modelo "plata + km" (`sim/pool_sim.js`) con el ancla real → saldo correcto por piloto.
4. **Escribir:** por cada piloto, insertar `ledger(type='migration_v2', amount = saldo_nuevo − saldo_actual, description='Restateo modelo v2 (pool a costo)')`. Setear `vehicles.pool_litros` y `pool_costo`.
5. **Validar:** `Σ(ledger.amount) == pool_costo` (test de invariante). Si no cierra, abortar y revisar.

> El restateo cambia saldos (Belu pasa a acreedora, etc.) → **avisar al grupo** con la tabla antes/después antes de ejecutar (decisión del usuario, ver `docs/05` §10).

---

## 4. Tests (antes de tocar producción)

En el simulador / lógica aislada (no en la app):
- **Invariante suma cero:** tras cualquier secuencia de cargas/viajes/reconciliaciones, `Σ balances == pool_costo`. (Ya validado en `sim/pool_sim.js`.)
- **Blend a costo:** 20 L @ $2.000 + 30 L @ $2.500 → precio $2.300; viaje de 10 L = $23.000. (`docs/05` §10.1.)
- **Reconciliación suma cero:** un ciclo con gap no cambia `Σ balances − pool_costo`.
- **Borrado de viaje:** revierte litros y costo al pool; balance vuelve al estado previo.
- **Settlement:** llevar deudores a cero deja a los acreedores con su crédito por nafta; `Σ = pool_costo`.

---

## 5. UI mínima (incluida en el alcance)

- **Tanque a costo** (mockup D): valor del tanque + quién lo aportó + "respaldado".
- **Smart Card / Saldar:** distinguir **deuda de consumo** (saldable en plata) de **crédito por nafta** (activo, se recupera al consumirse). Al saldar, llevar **deudores a cero** (no a todos).
- Diferido: UI de reconciliación 3 niveles, odómetro, notificaciones.

---

## 6. Despliegue y rollback

- **Código + migración juntos**, en el mismo momento (con el auto cargado a full).
- Bump de versión en los 3 lugares (app.js, index.html ×2, sw.js) + cache bust.
- Verificar post-deploy: invariante en datos reales + smoke test de una carga y un viaje.
- **Rollback:** si algo sale mal, el backup `backup/2026-06-17_taos_backup.sql` permite restaurar el estado previo (operación deliberada y revisada — el ledger es append-only).

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Código nuevo sobre datos viejos rompe balances | Desplegar código + migración **juntos**, nunca por separado. |
| El modelo afecta a TODOS los vehículos, no solo el Taos | Verificar que otros vehículos (si hay) tengan ancla; o migrar por vehículo. Hoy solo existe el Taos. |
| Restateo genera desconfianza ("¿por qué cambió mi saldo?") | Avisar al grupo con la tabla antes/después; cada saldo es auditable (Cargó − Consumió ± Recon). |
| Pérdida de datos | Backup hecho; rollback documentado. |
| Invariante no cierra post-migración | Test de validación obligatorio en paso 5; abortar si falla. |

---

*Plan v1 — Junio 2026. Asociado a `docs/05` §10. Para revisión antes de implementar.*
