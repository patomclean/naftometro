---
name: naftometro-ledger-rules
description: Strict rules for the immutable ledger and the three financial flows in Naftometro (Reconciliación, Settlement, Identity Claim). Use this skill whenever the task involves the ledger table, modifying balances between drivers, the ledger types (trip_cost, fuel_payment, transfer, tank_audit_adjustment, opening_balance), the PPP (Precio Promedio Ponderado), tank audits, "saldar deuda" / settlement, doble entrada contable, or anything that mutates the financial state. Also load this when working on `performTankAudit()`, `handleSettleDebtSubmit()`, `handleClaimIdentity()`, or any function that calculates balances. The ledger is append-only by design — load this skill before suggesting any UPDATE or DELETE on the ledger to avoid violating an invariant the entire app depends on.
metadata:
  version: 2.0.0
---

# Naftometro — Reglas del Ledger y los 3 Flujos Financieros

El ledger es el corazón contable de Naftometro. Esta skill define las reglas **inmutables** que no se pueden romper, y explica los 3 flujos que mutan el estado financiero.

## Regla de oro: el ledger es APPEND-ONLY

```
INSERT  → SÍ, siempre
SELECT  → SÍ, siempre
UPDATE  → NUNCA. No existe política RLS de UPDATE. No la agregues.
DELETE  → SOLO via cascade triggers cuando se borra el trip/payment original
```

**Por qué**: el ledger es un libro contable. Si pudieras editar entradas pasadas, los balances dejarían de ser reproducibles desde cero, y se rompe la auditoría. Si algo está mal, se compensa con una entrada nueva, no se edita la vieja.

**Si necesitás "corregir" algo**, insertá una entrada de signo opuesto que lo neutralice.

## Estructura de una entrada de ledger

```sql
ledger (
  id          bigint IDENTITY,
  vehicle_id  bigint NOT NULL,
  driver      text NOT NULL,                          -- nombre, no user_id
  type        text CHECK (type IN ('trip_cost', 'fuel_payment',
                                    'transfer', 'tank_audit_adjustment',
                                    'opening_balance', 'migration_v2')),
  amount      numeric NOT NULL,                       -- + crédito, - débito
  ref_id      bigint,                                 -- FK polimórfica (trip o payment)
  description text,
  created_at  timestamptz DEFAULT now()
)
```

### Convención del signo de `amount`

```
amount > 0  →  CRÉDITO  (al piloto le deben / aportó más de lo que consumió)
amount < 0  →  DÉBITO   (el piloto debe / consumió más de lo que aportó)
amount ≈ 0  →  al día
```

**Balance de un piloto** = `SUM(amount) WHERE driver = X AND vehicle_id = Y`.

## Los 6 tipos de ledger entry

| Type | Signo | Cuándo se inserta | `ref_id` apunta a |
|---|---|---|---|
| `trip_cost` | **negativo** al crear; **par +/−** al editar (reversión v19.1) | Al crear un trip en `handleTripSubmit()`; al editar km/tipo/piloto | `trips.id` |
| `fuel_payment` | **positivo** al crear; **par −/+** al editar (reversión v19.1) | Al crear un payment de carga en `handlePaymentSubmit()`; al editar monto/litros/piloto | `payments.id` |
| `transfer` | **par +/-** | Al saldar deuda (Flujo B). Se insertan 2 a la vez. | `payments.id` (legacy) o `null` |
| `tank_audit_adjustment` | depende (débito si faltó nafta) | Al cerrar un ciclo de tanque lleno (Flujo A, suma cero v19) | `null` |
| `opening_balance` | depende | Migración de datos legacy (v17) | `null` |
| `migration_v2` | depende | Restateo de saldos al migrar al modelo pool (v19.0, one-off) | `null` |

### Reglas por tipo

**`trip_cost`**:
- Siempre negativo (`amount = -costo_calculado`)
- Se inserta UNA vez por trip, en el mismo momento que el trip
- `description`: típicamente `"Viaje X km"` o similar

**`fuel_payment`**:
- Siempre positivo (`amount = +monto_pagado`)
- UNA vez por payment de carga (no aplica a payments tipo "settlement legacy")
- `description`: típicamente algo como `"Carga 20L a $1350/L"`

**`transfer`** (Flujo B — Settlement):
- Se insertan **siempre de a 2** (doble entrada contable):
  ```javascript
  // Pagador (su deuda baja)
  { driver: pagador,  type: 'transfer', amount: +monto }
  // Acreedor (su crédito baja)
  { driver: acreedor, type: 'transfer', amount: -monto }
  ```
- La suma de ambas es 0 → no afecta el total del vehículo, solo redistribuye
- No se permite `transfer` aislado (sería un agujero en la contabilidad)

**`tank_audit_adjustment`** (Flujo A — Reconciliación, semántica v19):
- Se inserta al cerrar un ciclo de tanque lleno si `pool_litros ≠ capacidad` (gap de consumo no registrado)
- El costo del gap se debita a los pilotos del ciclo **proporcional a sus km** y se descuenta del `pool_costo` (conserva la invariante)
- v19: ya NO hace UPDATE de `trips` ni toca `correction_factor` — los viajes cobrados quedan fijos

**`opening_balance`**:
- Solo en migraciones legacy. Cuando se introdujo el ledger en v17, los vehículos viejos necesitaron entradas de apertura para reflejar balances pre-existentes
- No se debería insertar en operación normal

## Los 3 flujos financieros — distinción crítica

| | **A: Reconciliación** | **B: Settlement** | **C: Identity Claim** |
|---|---|---|---|
| **Pregunta que responde** | "¿Cuánto consumió en serio?" | "¿Quién le paga a quién?" | "¿Qué piloto soy yo?" |
| **Disparador** | Carga marcada "tanque lleno" tras otra carga "tanque lleno" anterior | Botón "Saldar" en Smart Card (balance < 0) | Login en vehículo sin mapping previo |
| **Función JS** | `performTankAudit()` | `handleSettleDebtSubmit()` | `handleClaimIdentity()` |
| **Tablas que toca** | `ledger` (INSERT N, suma cero) + `vehicles` (reancla `pool_litros`/`pool_costo`, aprende `km_l_aprendido`) | `ledger` (INSERT 2x) + `audit_logs` (vía trigger) | `vehicle_driver_mappings` (INSERT) |
| **Tipo de ledger** | `tank_audit_adjustment` | `transfer` (2 entradas) | — (no toca ledger) |
| **¿Afecta costos de viajes?** | NO (v19: viajes cobrados quedan fijos) | NO | NO |
| **¿Afecta balances?** | SÍ (débito/crédito del gap por km) | SÍ (directo) | NO (los **revela** al activar smart card) |
| **¿Reversible?** | NO | NO | SÍ (DELETE del mapping) |
| **Visual** | Badge ✓ verde "Auditado" en trips | Smart card de rojo a neutral | Smart card se activa |

## Fórmulas relacionadas con el ledger (MODELO V2 — pool a costo, v19.0+)

> ⚠️ El modelo PPP / `correction_factor` / `current_ppp` / `virtual_liters` está **DEPRECADO desde v19.0**. Las columnas siguen en la tabla pero el código no las usa. La única fuente de verdad es el pool.

### La invariante central (TODO write debe preservarla)
```
SUM(ledger.amount por vehículo) === vehicles.pool_costo
```
No es "suma cero = $0": la suma es el **valor de la nafta que queda en el tanque**. Siempre hay algún piloto con crédito respaldado por nafta física.

### El pool
```
vehicles.pool_litros  — litros en el tanque
vehicles.pool_costo   — lo que se pagó por esa nafta
precio_pool           = pool_costo / pool_litros   (WAC, promedio ponderado a costo)
```
- **Carga**: entra al pool `(+litros, +neto)` con `neto = monto − descuento` (el mismo neto que el crédito `fuel_payment`).
- **Viaje**: sale del pool `(−litros, −costo)` con `litros = km / rinde_por_tipo`, `costo = litros × precio_pool`. Un viaje cobrado **queda fijo** — no se re-precia jamás (`recalculateTrips` es no-op desde v19).
- Toda mutación del pool pasa por `applyPoolDelta(vehicle, ΔL, ΔC)`.

### Rinde aprendido
`vehicles.km_l_aprendido` reemplaza a `correction_factor`. Se actualiza SOLO en `performTankAudit()` cuando el ciclo cerrado da un rinde **físicamente plausible (4–25 km/l)**. Sin esa guarda, el modelo viejo llegó a `correction_factor = 4.8364` en producción (viajes de ~$900/km). **NO quitar la guarda.**

### Reconciliación suma cero (performTankAudit, v19)
Al cerrar tanque lleno: `gap = pool_litros − capacidad`. El costo del gap se **debita a los pilotos del ciclo proporcional a sus km** (entradas `tank_audit_adjustment`) y se descuenta el mismo monto del `pool_costo` — la invariante se conserva exacta. NO inyecta saldo de la nada (bug del modelo viejo: +$82k) y NO re-precia viajes.

### Ediciones y borrados (v19.1) — patrón obligatorio
**Toda edición de viaje/carga = REVERSIÓN + NUEVO CARGO**, nunca UPDATE del ledger:
- Las entradas compensatorias llevan **el mismo `ref_id`** que el original → el cascade trigger las borra todas juntas al eliminar el registro, y su suma neta es exactamente el valor final guardado (borrar después de editar sigue consistente).
- Editar carga: par `fuel_payment` (−neto viejo al piloto viejo, +neto nuevo al nuevo) + `applyPoolDelta` del delta.
- Editar viaje solo-piloto: el débito se mueve con costo FIJO (pool intacto). Editar km/tipo: se re-precia al precio del pool post-reversión.
- Borrar viaje/carga: revertir litros Y costo al pool (el cascade ya sacó las entradas del ledger).
- "Limpiar viajes": restituir Σlitros y Σcosto de todos los viajes al pool antes de considerar terminada la operación.

Tests de referencia: `Naftometro/sim/pool_engine_test.js` (27 tests) + `Naftometro/sim/edit_flows_test.js` (20 asserts, fuzz 300 ops).

## Antipatrones que rompen el ledger

- ❌ Insertar `transfer` aislado (sin la entrada par del otro lado)
- ❌ Hacer UPDATE sobre una entrada de ledger existente — agregar política RLS de UPDATE
- ❌ Borrar manualmente entradas de ledger con DELETE (los cascade triggers lo hacen automáticamente al borrar trip/payment)
- ❌ Calcular balance desde `trips`/`payments` directamente — usar SIEMPRE el ledger
- ❌ Usar el `user_id` (UUID) en la columna `driver` del ledger — la columna espera el **nombre del piloto** (texto), no el UUID. La vinculación user→driver vive en `vehicle_driver_mappings`, no en el ledger
- ❌ Asumir que `ref_id` siempre tiene valor — para `transfer` y `tank_audit_adjustment` puede ser `null`
- ❌ Tocar `pool_litros`/`pool_costo` sin pasar por `applyPoolDelta()` con el delta espejo del ledger (rompe la invariante)
- ❌ Hacer UPDATE del monto de una entrada al editar un viaje/carga — usar el patrón REVERSIÓN + NUEVO CARGO con el mismo `ref_id` (v19.1)
- ❌ Revivir `correction_factor`/`current_ppp`/`virtual_liters` — están deprecados desde v19.0

## Reglas para agregar un type nuevo

Si en el futuro necesitás un nuevo tipo de entrada (ej: `refund`, `bonus`, etc.):

1. Agregar el valor al `CHECK` constraint en una migración SQL nueva
2. Definir claramente: ¿signo positivo, negativo o ambos? ¿Se inserta solo o en pares?
3. Decidir qué pasa al borrar la entidad referenciada en `ref_id` — ¿necesita cascade trigger?
4. Documentar en esta skill (bumpear MINOR version)
5. Si afecta el cálculo de balance, asegurarse que los renders consideren el nuevo tipo
