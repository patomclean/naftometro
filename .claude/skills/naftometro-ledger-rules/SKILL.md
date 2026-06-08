---
name: naftometro-ledger-rules
description: Strict rules for the immutable ledger and the three financial flows in Naftometro (Reconciliación, Settlement, Identity Claim). Use this skill whenever the task involves the ledger table, modifying balances between drivers, the ledger types (trip_cost, fuel_payment, transfer, tank_audit_adjustment, opening_balance), the PPP (Precio Promedio Ponderado), tank audits, "saldar deuda" / settlement, doble entrada contable, or anything that mutates the financial state. Also load this when working on `performTankAudit()`, `handleSettleDebtSubmit()`, `handleClaimIdentity()`, or any function that calculates balances. The ledger is append-only by design — load this skill before suggesting any UPDATE or DELETE on the ledger to avoid violating an invariant the entire app depends on.
metadata:
  version: 1.1.0
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
                                    'opening_balance')),
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

## Los 5 tipos de ledger entry

| Type | Signo | Cuándo se inserta | `ref_id` apunta a |
|---|---|---|---|
| `trip_cost` | **negativo** (consumió) | Al crear un trip, en `handleTripSubmit()` | `trips.id` |
| `fuel_payment` | **positivo** (aportó dinero) | Al crear un payment de carga, en `handlePaymentSubmit()` | `payments.id` |
| `transfer` | **par +/-** | Al saldar deuda (Flujo B). Se insertan 2 a la vez. | `payments.id` (legacy) o `null` |
| `tank_audit_adjustment` | depende | Al cerrar un ciclo de tanque lleno (Flujo A) | `null` o `trips.id` afectado |
| `opening_balance` | depende | Migración de datos legacy | `null` |

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

**`tank_audit_adjustment`** (Flujo A — Reconciliación):
- Se inserta cuando un ciclo de tanque lleno cierra y el consumo real difiere del teórico
- Suma neta del ciclo debe ser 0 (lo que un piloto pierde, otro lo gana)
- Acompañado de un UPDATE en `trips` (`is_reconciled = true`, ajuste de `liters` y `cost`)

**`opening_balance`**:
- Solo en migraciones legacy. Cuando se introdujo el ledger en v17, los vehículos viejos necesitaron entradas de apertura para reflejar balances pre-existentes
- No se debería insertar en operación normal

## Los 3 flujos financieros — distinción crítica

| | **A: Reconciliación** | **B: Settlement** | **C: Identity Claim** |
|---|---|---|---|
| **Pregunta que responde** | "¿Cuánto consumió en serio?" | "¿Quién le paga a quién?" | "¿Qué piloto soy yo?" |
| **Disparador** | Carga marcada "tanque lleno" tras otra carga "tanque lleno" anterior | Botón "Saldar" en Smart Card (balance < 0) | Login en vehículo sin mapping previo |
| **Función JS** | `performTankAudit()` | `handleSettleDebtSubmit()` | `handleClaimIdentity()` |
| **Tablas que toca** | `trips` (UPDATE) + `ledger` (INSERT N) + `vehicles` (UPDATE de `correction_factor`) | `ledger` (INSERT 2x) + `audit_logs` (vía trigger) | `vehicle_driver_mappings` (INSERT) |
| **Tipo de ledger** | `tank_audit_adjustment` | `transfer` (2 entradas) | — (no toca ledger) |
| **¿Afecta costos de viajes?** | **SÍ** (UPDATE trips) | NO | NO |
| **¿Afecta balances?** | SÍ (indirecto, vía trips) | SÍ (directo) | NO (los **revela** al activar smart card) |
| **¿Reversible?** | NO | NO | SÍ (DELETE del mapping) |
| **Visual** | Badge ✓ verde "Auditado" en trips | Smart card de rojo a neutral | Smart card se activa |

## Fórmulas relacionadas con el ledger

### PPP (Precio Promedio Ponderado)
Cuando se inserta una carga, antes de el ledger entry se actualiza el PPP del vehículo:

```
nuevo_ppp = (litros_virtuales × ppp_actual + monto_pagado) / 
            (litros_virtuales + litros_nuevos)
```

Esto se persiste en `vehicles.current_ppp`. Los siguientes `trip_cost` se calculan con este PPP.

**Guardas defensivas (v18.15) — NO quitarlas.** `current_ppp` y `virtual_liters` son campos derivados sin historial; si se corrompen, el promedio se rompe (en v18.15 un `virtual_liters=80.091` hundio el PPP a $3, generando viajes de costo irreal). `handlePaymentSubmit()` aplica:
1. **clamp de `oldLiters`** a `[0, capacidad]` via `clampTankLiters()` — un `virtual_liters` corrupto no domina el promedio.
2. **saneo de `oldPPP`**: si es < 10% del precio de la carga, no se usa para el blend.
3. **piso de `newPPP`**: si queda < 20% del precio de la carga, se usa el precio de la carga.

Todos los writes de `virtual_liters` (crear/borrar viaje, registrar carga) pasan por `clampTankLiters()`. **Importante:** `handleDeleteTrip()` debe devolver los litros del viaje al tanque al borrar (bug corregido en v18.15) — si no, `virtual_liters` queda descuadrado.

### Costo de un viaje
```
consumo_ajustado = consumo_teorico_por_tipo × correction_factor
litros = km / consumo_ajustado
costo = litros × current_ppp
```

`correction_factor` viene de la última reconciliación (Flujo A). Default `1.0`.

### Factor de reconciliación (en performTankAudit)
```
factor_desviacion = litros_reales_ciclo / litros_estimados_ciclo
correction_factor_nuevo = total_litros_reales_historia / total_litros_estimados_historia
```

## Antipatrones que rompen el ledger

- ❌ Insertar `transfer` aislado (sin la entrada par del otro lado)
- ❌ Hacer UPDATE sobre una entrada de ledger existente — agregar política RLS de UPDATE
- ❌ Borrar manualmente entradas de ledger con DELETE (los cascade triggers lo hacen automáticamente al borrar trip/payment)
- ❌ Calcular balance desde `trips`/`payments` directamente — usar SIEMPRE el ledger
- ❌ Usar el `user_id` (UUID) en la columna `driver` del ledger — la columna espera el **nombre del piloto** (texto), no el UUID. La vinculación user→driver vive en `vehicle_driver_mappings`, no en el ledger
- ❌ Asumir que `ref_id` siempre tiene valor — para `transfer` y `tank_audit_adjustment` puede ser `null`
- ❌ Modificar `correction_factor` o `current_ppp` sin pasar por los flujos correspondientes (rompe consistencia)

## Reglas para agregar un type nuevo

Si en el futuro necesitás un nuevo tipo de entrada (ej: `refund`, `bonus`, etc.):

1. Agregar el valor al `CHECK` constraint en una migración SQL nueva
2. Definir claramente: ¿signo positivo, negativo o ambos? ¿Se inserta solo o en pares?
3. Decidir qué pasa al borrar la entidad referenciada en `ref_id` — ¿necesita cascade trigger?
4. Documentar en esta skill (bumpear MINOR version)
5. Si afecta el cálculo de balance, asegurarse que los renders consideren el nuevo tipo
