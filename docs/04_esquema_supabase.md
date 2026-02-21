# Naftometro - Esquema de Base de Datos (Supabase)

## Infraestructura

- **Proveedor:** Supabase (PostgreSQL)
- **URL:** `https://vablrtbwxitoiqyzyama.supabase.co`
- **SDK:** `@supabase/supabase-js@2` via CDN
- **Autenticacion:** Clave anonima (anon key) — sin auth de usuario
- **Storage:** Bucket `fuel-tickets` para fotos de tickets

---

## Diagrama de Relaciones

```
┌──────────────┐
│   vehicles   │
│──────────────│
│ id (PK)      │───┐
│ name         │   │
│ model        │   │
│ consumption  │   │
│ fuel_type    │   │
│ fuel_price   │   │
│ drivers[]    │   │
│ created_at   │   │
└──────────────┘   │
                   │
       ┌───────────┼───────────┐
       │           │           │
       ▼           │           ▼
┌──────────────┐   │   ┌──────────────────┐
│    trips     │   │   │    payments       │
│──────────────│   │   │──────────────────│
│ id (PK)      │   │   │ id (PK)          │
│ vehicle_id   │◄──┘──►│ vehicle_id       │
│ driver       │       │ driver           │
│ km           │       │ amount           │
│ liters       │       │ liters_loaded    │
│ cost         │       │ price_per_liter  │
│ drive_type   │       │ is_full_tank     │
│ note         │       │ invoice_type     │
│ occurred_at  │       │ tax_perceptions  │
│ is_reconciled│       │ discount_amount  │
│ reconciled_at│       │ note             │
│ original_    │       │ occurred_at      │
│  consumption │       │ photo_url        │
│ real_        │       │ created_at       │
│  consumption │       └──────────────────┘
│ created_at   │
└──────────────┘

┌─────────────────────────────┐
│  Storage: fuel-tickets      │
│─────────────────────────────│
│  {vehicle_id}/{timestamp}.jpg│
│  Referenciado por           │
│  payments.photo_url         │
└─────────────────────────────┘
```

---

## Tabla: `vehicles`

Almacena los vehiculos registrados. Cada vehiculo tiene multiples pilotos (conductores).

| Columna | Tipo PostgreSQL | Nullable | Default | Descripcion |
|---------|----------------|----------|---------|-------------|
| `id` | `bigint` | NO | auto-generado | Primary key |
| `name` | `text` | NO | — | Nombre descriptivo ("Auto familiar") |
| `model` | `text` | NO | — | Modelo del vehiculo ("VW Gol Trend 1.6") |
| `consumption` | `numeric` | NO | — | Consumo aprendido en km/l (se actualiza con reconciliacion) |
| `fuel_type` | `text` | NO | — | Tipo de combustible ("Super (95 octanos)") |
| `fuel_price` | `numeric` | NO | — | Precio promedio ponderado del litro en pesos |
| `drivers` | `text[]` | NO | — | Array de nombres de pilotos |
| `created_at` | `timestamptz` | NO | `now()` | Fecha de creacion |

### Notas
- `consumption` se inicializa con el valor teorico del `VEHICLE_DATABASE` y se actualiza automaticamente con `recalculateGlobalConsumption()` despues de cada reconciliacion
- `fuel_price` se actualiza con promedio ponderado cada vez que se registra una carga
- `drivers` es un array nativo de PostgreSQL (`text[]`), no JSON

### Queries principales
```sql
-- Fetch all vehicles
SELECT * FROM vehicles ORDER BY created_at ASC;

-- Create vehicle
INSERT INTO vehicles (name, model, consumption, fuel_type, fuel_price, drivers) VALUES (...);

-- Update vehicle
UPDATE vehicles SET ... WHERE id = $1;

-- Delete vehicle
DELETE FROM vehicles WHERE id = $1;
```

---

## Tabla: `trips`

Registra cada viaje realizado. Los costos se calculan client-side y se almacenan. La reconciliacion puede recalcular `liters` y `cost`.

| Columna | Tipo PostgreSQL | Nullable | Default | Descripcion |
|---------|----------------|----------|---------|-------------|
| `id` | `bigint` | NO | auto-generado | Primary key |
| `vehicle_id` | `bigint` | NO | — | FK a `vehicles.id` |
| `driver` | `text` | NO | — | Nombre del piloto |
| `km` | `numeric` | NO | — | Distancia recorrida en km |
| `liters` | `numeric` | NO | — | Litros consumidos (calculado: `km / consumo`) |
| `cost` | `numeric` | NO | — | Costo del viaje en pesos (calculado: `liters * precio`) |
| `drive_type` | `text` | SI | `'Mixto'` | Modo de manejo: "Urbano", "Mixto", o "Ruta" |
| `note` | `text` | SI | `null` | Nota opcional del viaje |
| `occurred_at` | `timestamptz` | SI | — | Fecha/hora real del viaje (v14.6) |
| `is_reconciled` | `boolean` | SI | `false` | Marcado `true` despues de reconciliacion de tanque lleno |
| `reconciled_at` | `timestamptz` | SI | `null` | Fecha/hora de la reconciliacion (v14.2) |
| `original_consumption` | `numeric` | SI | `null` | Consumo teorico original usado en la estimacion (km/l) |
| `real_consumption` | `numeric` | SI | `null` | Consumo real ajustado por reconciliacion (km/l) |
| `created_at` | `timestamptz` | NO | `now()` | Fecha de registro en el sistema |

### Relaciones
- `vehicle_id` → `vehicles.id` (muchos a uno)
- Cascade: al eliminar un vehiculo se borran todos sus viajes via `deleteTripsForVehicle(vehicleId)`

### Ciclo de vida de un viaje
1. **Creacion:** `liters` y `cost` se calculan con consumo teorico del vehiculo
2. **Reconciliacion:** Si el viaje cae en un ciclo cerrado de tanque lleno, `liters` y `cost` se recalculan con el consumo real, y se marcan `is_reconciled = true`, `reconciled_at`, `original_consumption`, `real_consumption`
3. **Recalculo global:** Si se edita el vehiculo (precio o consumo), todos los viajes se recalculan via `recalculateTrips()`

### Queries principales
```sql
-- Fetch trips for a vehicle
SELECT * FROM trips WHERE vehicle_id = $1 ORDER BY created_at DESC;

-- Create trip
INSERT INTO trips (vehicle_id, driver, km, liters, cost, drive_type, note, occurred_at) VALUES (...);

-- Reconciliation (primary)
UPDATE trips SET liters = $2, cost = $3, is_reconciled = true WHERE id = $1;

-- Reconciliation (metadata)
UPDATE trips SET reconciled_at = $2, original_consumption = $3, real_consumption = $4 WHERE id = $1;

-- Recalculate all trips for a vehicle
UPDATE trips SET liters = $2, cost = $3 WHERE id = $1;
-- (ejecutado en loop client-side para cada viaje)

-- Delete all trips for a vehicle
DELETE FROM trips WHERE vehicle_id = $1;

-- Dashboard: fetch last trip per vehicle
SELECT vehicle_id, driver, created_at FROM trips
WHERE vehicle_id IN (...) ORDER BY created_at DESC;
```

---

## Tabla: `payments`

Registra cargas de combustible y pagos de liquidacion (saldos entre pilotos).

| Columna | Tipo PostgreSQL | Nullable | Default | Descripcion |
|---------|----------------|----------|---------|-------------|
| `id` | `bigint` | NO | auto-generado | Primary key |
| `vehicle_id` | `bigint` | NO | — | FK a `vehicles.id` |
| `driver` | `text` | NO | — | Nombre del piloto que pago |
| `amount` | `numeric` | NO | — | Monto total pagado en pesos |
| `liters_loaded` | `numeric` | SI | `null` | Litros cargados (`null` para liquidaciones de saldo) |
| `price_per_liter` | `numeric` | SI | `null` | Precio efectivo por litro (`null` para liquidaciones) |
| `is_full_tank` | `boolean` | SI | `false` | Indica si se lleno el tanque completamente |
| `invoice_type` | `text` | SI | `'Ticket'` | Tipo de comprobante: "Factura A" o "Ticket" |
| `tax_perceptions` | `numeric` | SI | `0` | Percepciones fiscales en pesos (solo Factura A) |
| `discount_amount` | `numeric` | SI | `0` | Descuentos aplicados en pesos |
| `note` | `text` | SI | `null` | Nota opcional ("Saldado de deuda a: ..." para liquidaciones) |
| `occurred_at` | `timestamptz` | SI | — | Fecha/hora real del pago (v14.6) |
| `photo_url` | `text` | SI | `null` | URL publica de la foto del ticket en Supabase Storage (v15) |
| `created_at` | `timestamptz` | NO | `now()` | Fecha de registro en el sistema |

### Tipos de pago

**Carga de combustible (normal):**
- `liters_loaded` > 0, `price_per_liter` > 0
- `is_full_tank` puede ser `true` o `false`
- Puede tener `photo_url`, `tax_perceptions`, `discount_amount`

**Liquidacion de saldo (settlement):**
- `liters_loaded` = `null`, `price_per_liter` = `null`
- `is_full_tank` = `false`
- `invoice_type` = `'Ticket'`, `tax_perceptions` = `0`, `discount_amount` = `0`
- `note` contiene "Saldado" (patron de deteccion: `note.toLowerCase().includes('saldado') && !liters_loaded`)

### Relaciones
- `vehicle_id` → `vehicles.id` (muchos a uno)
- `photo_url` → archivo en Storage bucket `fuel-tickets`

### Queries principales
```sql
-- Fetch payments for a vehicle
SELECT * FROM payments WHERE vehicle_id = $1 ORDER BY created_at DESC;

-- Create payment
INSERT INTO payments (vehicle_id, driver, amount, liters_loaded, price_per_liter,
  is_full_tank, invoice_type, tax_perceptions, discount_amount, note, occurred_at, photo_url)
VALUES (...);

-- Update payment
UPDATE payments SET ... WHERE id = $1;

-- Delete payment
DELETE FROM payments WHERE id = $1;

-- Dashboard: fetch latest fuel prices per vehicle
SELECT vehicle_id, price_per_liter FROM payments
WHERE vehicle_id IN (...) AND price_per_liter > 0
ORDER BY created_at DESC;

-- Dashboard: fetch all payments
SELECT * FROM payments ORDER BY created_at DESC;
```

---

## Supabase Storage: Bucket `fuel-tickets`

Almacena fotos de tickets de combustible.

### Estructura de archivos
```
fuel-tickets/
  {vehicle_id}/
    {timestamp}.jpg       ← JPEG, max 1200px, calidad 80%
```

### Operaciones

| Operacion | Metodo | Descripcion |
|-----------|--------|-------------|
| Upload | `storage.from('fuel-tickets').upload(path, blob)` | Sube foto redimensionada |
| Get URL | `storage.from('fuel-tickets').getPublicUrl(path)` | Obtiene URL publica |
| Delete | `storage.from('fuel-tickets').remove([path])` | Elimina foto (best-effort) |

### Procesamiento client-side (antes del upload)
1. Se captura la imagen via `<input type="file" accept="image/*" capture="environment">`
2. Se redimensiona en un `<canvas>` a maximo 1200x1200 px manteniendo proporcion
3. Se exporta como JPEG al 80% de calidad (`canvas.toBlob(..., 'image/jpeg', 0.8)`)
4. Se sube con `contentType: 'image/jpeg'` y `upsert: false`

### Limpieza
Al eliminar un payment con `photo_url`, se extrae el path del URL y se intenta borrar del bucket. Si falla, el archivo queda huerfano (se acepta como trade-off).

---

## Indices Recomendados

Basado en los patrones de query observados en el codigo:

```sql
-- Indice para fetch de viajes por vehiculo (query mas frecuente)
CREATE INDEX idx_trips_vehicle_id ON trips (vehicle_id);

-- Indice para fetch de pagos por vehiculo
CREATE INDEX idx_payments_vehicle_id ON payments (vehicle_id);

-- Indice para ordenamiento cronologico
CREATE INDEX idx_trips_created_at ON trips (created_at DESC);
CREATE INDEX idx_payments_created_at ON payments (created_at DESC);

-- Indice para busqueda de tanques llenos (reconciliacion)
CREATE INDEX idx_payments_full_tank ON payments (vehicle_id, is_full_tank)
WHERE is_full_tank = true AND liters_loaded > 0;
```

**Nota:** Supabase crea automaticamente indices en primary keys. Los indices adicionales son recomendaciones basadas en los patrones de acceso del frontend.

---

## Consideraciones de Seguridad

### Estado actual
- La app usa la **anon key** de Supabase sin autenticacion de usuario
- No hay Row Level Security (RLS) habilitado — cualquier persona con la key puede leer/escribir
- Las credenciales estan expuestas en el codigo fuente (client-side)

### Recomendaciones para produccion
1. Habilitar RLS en las 3 tablas
2. Implementar autenticacion de usuario (Supabase Auth)
3. Crear policies que limiten acceso por usuario
4. Mover la anon key a variables de entorno en el deploy
5. Restringir el bucket `fuel-tickets` a usuarios autenticados
