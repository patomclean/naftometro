# Naftometro - Esquema de Base de Datos (Supabase)

## Infraestructura

- **Proveedor:** Supabase (PostgreSQL)
- **URL:** `https://vablrtbwxitoiqyzyama.supabase.co`
- **SDK:** `@supabase/supabase-js@2` via CDN
- **Autenticacion:** Supabase Auth (email/password) — activado desde v18
- **RLS:** Row Level Security habilitado en todas las tablas desde v16.0
- **Storage:** Bucket `fuel-tickets` para fotos de tickets

---

## Diagrama de Relaciones Completo

```
┌─────────────────┐
│   auth.users    │  ← Supabase Auth
│─────────────────│
│ id (uuid PK)    │───┐
└─────────────────┘   │
                      │ ON DELETE CASCADE
         ┌────────────┼───────────────────────────────────────┐
         ▼            ▼                                        ▼
┌──────────────┐  ┌──────────────────────┐     ┌─────────────────────────┐
│   profiles   │  │  vehicle_members     │     │vehicle_driver_mappings  │
│──────────────│  │──────────────────────│     │─────────────────────────│
│ id (PK/FK)   │  │ vehicle_id (PK/FK)   │     │ id (PK)                 │
│ display_name │  │ user_id (PK/FK)      │     │ vehicle_id (FK)         │
│ currency     │  │ role (owner/member)  │     │ user_id (FK)            │
│ onboarding.. │  │ joined_at            │     │ driver_name             │
│ created_at   │  └──────────────────────┘     │ created_at              │
└──────────────┘           │                   └─────────────────────────┘
                           │ vehicle_id FK
                           ▼
                  ┌──────────────┐
                  │   vehicles   │
                  │──────────────│
                  │ id (PK)      │─────────────────────────────────────┐
                  │ name         │                                      │
                  │ model        │◄────── vehicle_id FK en:            │
                  │ consumption  │   trips, payments, ledger,          │
                  │ fuel_type    │   vehicle_members,                  │
                  │ fuel_price   │   vehicle_driver_mappings,          │
                  │ drivers[]    │   audit_logs                        │
                  │ owner_id(FK) │                                      │
                  │ invite_code  │                                      │
                  │ current_ppp  │  ← v17: PPP persistente             │
                  │ virtual_liters│ ← v17: litros virtuales            │
                  │ correction_  │  ← v17: factor de ajuste           │
                  │  factor      │                                      │
                  │ last_full_   │  ← v17: timestamp ultimo tanque     │
                  │  tank_at     │       lleno                         │
                  │ created_at   │                                      │
                  └──────────────┘                                      │
                        │                                               │
          ┌─────────────┼──────────────────┐                           │
          ▼             ▼                  ▼                           ▼
┌──────────────┐ ┌──────────────────┐ ┌──────────┐         ┌──────────────┐
│    trips     │ │    payments      │ │  ledger  │         │  audit_logs  │
│──────────────│ │──────────────────│ │──────────│         │──────────────│
│ id (PK)      │ │ id (PK)          │ │ id (PK)  │         │ id (uuid PK) │
│ vehicle_id   │ │ vehicle_id       │ │ vehicle_id│        │ vehicle_id   │
│ driver       │ │ driver           │ │ driver   │         │ user_id (FK) │
│ km           │ │ amount           │ │ type     │         │ action       │
│ liters       │ │ liters_loaded    │ │ amount   │         │ description  │
│ cost         │ │ price_per_liter  │ │ ref_id   │         │ created_at   │
│ drive_type   │ │ is_full_tank     │ │ description│       └──────────────┘
│ note         │ │ invoice_type     │ │ created_at│
│ occurred_at  │ │ tax_perceptions  │ └──────────┘
│ is_reconciled│ │ discount_amount  │
│ reconciled_at│ │ note             │
│ original_    │ │ occurred_at      │
│  consumption │ │ photo_url        │
│ real_        │ │ created_at       │
│  consumption │ └──────────────────┘
│ created_at   │
└──────────────┘

┌─────────────────────────────┐
│  Storage: fuel-tickets      │
│─────────────────────────────│
│  {vehicle_id}/{timestamp}.jpg│
│  Referenciado por            │
│  payments.photo_url          │
└─────────────────────────────┘
```

---

## Tabla: `vehicles`

Almacena los vehiculos registrados. Cada vehiculo tiene multiples pilotos (conductores).

| Columna | Tipo PostgreSQL | Nullable | Default | Version | Descripcion |
|---------|----------------|----------|---------|---------|-------------|
| `id` | `bigint` | NO | auto-generado | v1 | Primary key |
| `name` | `text` | NO | — | v1 | Nombre descriptivo ("Auto familiar") |
| `model` | `text` | NO | — | v1 | Modelo del vehiculo ("VW Gol Trend 1.6") |
| `consumption` | `numeric` | NO | — | v1 | Consumo aprendido en km/l (se actualiza con reconciliacion) |
| `fuel_type` | `text` | NO | — | v1 | Tipo de combustible ("Super (95 octanos)") |
| `fuel_price` | `numeric` | NO | — | v1 | Precio promedio ponderado del litro en pesos (legacy) |
| `drivers` | `text[]` | NO | — | v1 | Array de nombres de pilotos |
| `owner_id` | `uuid` | SI | `null` | v16.0 | FK a auth.users — dueno del vehiculo |
| `invite_code` | `text` | SI | `null` | v16.2 | Codigo de invitacion unico (6 chars, UNIQUE) |
| `current_ppp` | `numeric` | SI | `0` | v17 | Precio Promedio Ponderado actual del combustible en tanque |
| `virtual_liters` | `numeric` | SI | `0` | v17 | Litros estimados remanentes en tanque virtual |
| `correction_factor` | `numeric` | SI | `1.0` | v17 | Multiplicador de consumo real vs teorico |
| `last_full_tank_at` | `timestamptz` | SI | `null` | v17 | Timestamp de la ultima carga de tanque lleno |
| `created_at` | `timestamptz` | NO | `now()` | v1 | Fecha de creacion |

### Notas
- `consumption` se inicializa con el valor teorico del `VEHICLE_DATABASE` y se actualiza con `recalculateGlobalConsumption()` despues de cada reconciliacion
- `fuel_price` es el precio de referencia manual ingresado al crear el vehiculo; desde v17 se usa `current_ppp` para calculos
- `correction_factor = 1.0` significa que el consumo real coincide con el teorico. Se actualiza en cada ciclo de reconciliacion
- `drivers` es un array nativo de PostgreSQL (`text[]`), no JSON

---

## Tabla: `trips`

Registra cada viaje realizado. Los costos se calculan client-side y se almacenan. La reconciliacion puede recalcular `liters` y `cost`.

| Columna | Tipo PostgreSQL | Nullable | Default | Version | Descripcion |
|---------|----------------|----------|---------|---------|-------------|
| `id` | `bigint` | NO | auto-generado | v1 | Primary key |
| `vehicle_id` | `bigint` | NO | — | v1 | FK a `vehicles.id` (CASCADE DELETE desde v16) |
| `driver` | `text` | NO | — | v1 | Nombre del piloto |
| `km` | `numeric` | NO | — | v1 | Distancia recorrida en km |
| `liters` | `numeric` | NO | — | v1 | Litros consumidos (calculado: `km / consumo`) |
| `cost` | `numeric` | NO | — | v1 | Costo del viaje en pesos (calculado: `liters * precio`) |
| `drive_type` | `text` | SI | `'Mixto'` | v13 | Modo de manejo: "Urbano", "Mixto", o "Ruta" |
| `note` | `text` | SI | `null` | v1 | Nota opcional del viaje |
| `occurred_at` | `timestamptz` | SI | — | v14.6 | Fecha/hora real del viaje |
| `is_reconciled` | `boolean` | SI | `false` | v14.1 | Marcado `true` despues de reconciliacion de tanque lleno |
| `reconciled_at` | `timestamptz` | SI | `null` | v14.2 | Fecha/hora de la reconciliacion |
| `original_consumption` | `numeric` | SI | `null` | v14.1 | Consumo teorico original usado en la estimacion (km/l) |
| `real_consumption` | `numeric` | SI | `null` | v14.1 | Consumo real ajustado por reconciliacion (km/l) |
| `created_at` | `timestamptz` | NO | `now()` | v1 | Fecha de registro en el sistema |

### Ciclo de vida de un viaje
1. **Creacion:** `liters` y `cost` se calculan con consumo teorico del vehiculo × correction_factor
2. **Reconciliacion:** Si el viaje cae en un ciclo cerrado de tanque lleno, `liters` y `cost` se recalculan con el consumo real, y se marcan `is_reconciled = true`, `reconciled_at`, `original_consumption`, `real_consumption`
3. **Recalculo global:** Si se edita el vehiculo (precio o consumo), todos los viajes no-reconciliados se recalculan via `recalculateTrips()`
4. **Eliminacion:** BEFORE DELETE trigger elimina las entradas del ledger con `type='trip_cost'` y `ref_id=trip.id` (v18.4)

---

## Tabla: `payments`

Registra cargas de combustible y pagos de liquidacion (saldos entre pilotos).

| Columna | Tipo PostgreSQL | Nullable | Default | Version | Descripcion |
|---------|----------------|----------|---------|---------|-------------|
| `id` | `bigint` | NO | auto-generado | v1 | Primary key |
| `vehicle_id` | `bigint` | NO | — | v1 | FK a `vehicles.id` (CASCADE DELETE desde v16) |
| `driver` | `text` | NO | — | v1 | Nombre del piloto que pago |
| `amount` | `numeric` | NO | — | v1 | Monto total pagado en pesos |
| `liters_loaded` | `numeric` | SI | `null` | v1 | Litros cargados (`null` para liquidaciones de saldo) |
| `price_per_liter` | `numeric` | SI | `null` | v1 | Precio efectivo por litro (`null` para liquidaciones) |
| `is_full_tank` | `boolean` | SI | `false` | v1 | Indica si se lleno el tanque completamente |
| `invoice_type` | `text` | SI | `'Ticket'` | v10 | Tipo de comprobante: "Factura A" o "Ticket" |
| `tax_perceptions` | `numeric` | SI | `0` | v10 | Percepciones fiscales en pesos (solo Factura A) |
| `discount_amount` | `numeric` | SI | `0` | v10 | Descuentos aplicados en pesos |
| `note` | `text` | SI | `null` | v1 | Nota opcional ("Saldado de deuda a: ..." para liquidaciones) |
| `occurred_at` | `timestamptz` | SI | — | v14.6 | Fecha/hora real del pago |
| `photo_url` | `text` | SI | `null` | v15 | URL publica de la foto del ticket en Supabase Storage |
| `created_at` | `timestamptz` | NO | `now()` | v1 | Fecha de registro en el sistema |

### Tipos de pago

**Carga de combustible (normal):**
- `liters_loaded` > 0, `price_per_liter` > 0
- `is_full_tank` puede ser `true` o `false`
- Puede tener `photo_url`, `tax_perceptions`, `discount_amount`

**Liquidacion de saldo (settlement) — patron legacy:**
- `liters_loaded` = `null`, `price_per_liter` = `null`
- `note` contiene "Saldado" (detection: `note.toLowerCase().includes('saldado') && !liters_loaded`)
- Desde v18.6 los settlements se registran via ledger entries tipo 'transfer', no como payments

### Ciclo de vida de un payment
1. **Creacion:** Se calcula el precio efectivo por litro y se actualiza el PPP del vehiculo
2. **Tanque lleno:** Si `is_full_tank=true`, dispara el ciclo de reconciliacion
3. **Eliminacion:** BEFORE DELETE trigger elimina entradas del ledger con `type IN ('fuel_payment','transfer')` y `ref_id=payment.id` (v18.4)

---

## Tabla: `ledger` (v17+)

Libro contable inmutable. Positivo = credito, negativo = debito. **Solo INSERT, nunca UPDATE ni DELETE manual.**

| Columna | Tipo PostgreSQL | Nullable | Default | Descripcion |
|---------|----------------|----------|---------|-------------|
| `id` | `bigint GENERATED ALWAYS AS IDENTITY` | NO | auto-generado | Primary key |
| `vehicle_id` | `bigint` | NO | — | FK a `vehicles.id` (CASCADE DELETE) |
| `driver` | `text` | NO | — | Nombre del piloto |
| `type` | `text` CHECK | NO | — | `trip_cost` / `fuel_payment` / `transfer` / `tank_audit_adjustment` / `opening_balance` |
| `amount` | `numeric` | NO | — | Positivo = credito, negativo = debito |
| `ref_id` | `bigint` | SI | `null` | FK polimorficamente a trips.id o payments.id |
| `description` | `text` | SI | `null` | Descripcion legible en lenguaje natural |
| `created_at` | `timestamptz` | NO | `now()` | Timestamp inmutable |

### Tipos de entradas

| type | amount | Se inserta cuando |
|------|--------|-------------------|
| `fuel_payment` | `+amount` | Se registra una carga de combustible |
| `trip_cost` | `-cost` | Se registra un viaje |
| `transfer` | `+amount` (pagador) / `-amount` (acreedor) | Se salda una deuda (doble entrada) |
| `tank_audit_adjustment` | diferencia | Se reconcilia un ciclo de tanque lleno |
| `opening_balance` | neto historico | Se migra un vehiculo legacy a ledger |

### Politicas RLS
- `SELECT`: solo miembros del vehiculo
- `INSERT`: solo miembros del vehiculo
- `DELETE`: solo miembros del vehiculo (para cascade triggers v18.4)
- Sin politica de `UPDATE` — inmutable por diseno

---

## Tabla: `vehicle_members` (v16.0+)

Membresias de vehiculos — gestiona el acceso multi-usuario y sirve de base para todas las politicas RLS.

| Columna | Tipo PostgreSQL | Nullable | Default | Descripcion |
|---------|----------------|----------|---------|-------------|
| `vehicle_id` | `bigint` | NO | — | FK a `vehicles.id` (PK compuesta, CASCADE DELETE) |
| `user_id` | `uuid` | NO | — | FK a `auth.users` (PK compuesta, CASCADE DELETE) |
| `role` | `text` CHECK | NO | `'member'` | `owner` o `member` |
| `joined_at` | `timestamptz` | NO | `now()` | Fecha de union |

### Politicas RLS
- `SELECT`: cualquier miembro del vehiculo puede ver otros miembros
- `INSERT`: solo el owner puede agregar miembros (excepto join por invite que usa SECURITY DEFINER)
- `DELETE`: el owner puede eliminar cualquier miembro; cualquier usuario puede eliminarse a si mismo

---

## Tabla: `profiles` (v18.0+)

Perfiles de usuarios autenticados. Se crea automaticamente via trigger al registrarse.

| Columna | Tipo PostgreSQL | Nullable | Default | Descripcion |
|---------|----------------|----------|---------|-------------|
| `id` | `uuid` | NO | — | PK, FK a `auth.users` (CASCADE DELETE) |
| `display_name` | `text` | SI | `null` | Nombre a mostrar en la app |
| `currency` | `text` | NO | `'ARS'` | Moneda preferida |
| `onboarding_completed` | `boolean` | NO | `false` | Si el usuario completo el onboarding |
| `created_at` | `timestamptz` | NO | `now()` | Fecha de creacion |

### Politicas RLS
- `SELECT`: solo puede ver su propio perfil (`id = auth.uid()`)
- `INSERT`: solo puede crear su propio perfil
- `UPDATE`: solo puede editar su propio perfil

---

## Tabla: `vehicle_driver_mappings` (v18.0+)

Vincula usuarios autenticados con nombres de piloto por vehiculo (estilo Tricount: "reclamo" de identidad).

| Columna | Tipo PostgreSQL | Nullable | Default | Descripcion |
|---------|----------------|----------|---------|-------------|
| `id` | `bigint GENERATED ALWAYS AS IDENTITY` | NO | auto-generado | Primary key |
| `vehicle_id` | `bigint` | NO | — | FK a `vehicles.id` (CASCADE DELETE) |
| `user_id` | `uuid` | NO | — | FK a `auth.users` (CASCADE DELETE) |
| `driver_name` | `text` | NO | — | Nombre del piloto reclamado |
| `created_at` | `timestamptz` | NO | `now()` | Fecha de vinculacion |
| UNIQUE | — | — | — | `(vehicle_id, user_id)` — un usuario, un piloto por vehiculo |
| UNIQUE | — | — | — | `(vehicle_id, driver_name)` — un piloto no puede ser reclamado dos veces |

### Politicas RLS
- `SELECT`: cualquier miembro del vehiculo
- `INSERT`: cualquier miembro del vehiculo
- `DELETE`: solo el usuario puede eliminar su propia vinculacion

---

## Tabla: `audit_logs` (v18.5+)

Registro inmutable de eventos del sistema. Se llena automaticamente via triggers de PostgreSQL, nunca manualmente.

| Columna | Tipo PostgreSQL | Nullable | Default | Descripcion |
|---------|----------------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `vehicle_id` | `bigint` | NO | — | FK a `vehicles.id` (CASCADE DELETE) |
| `user_id` | `uuid` | SI | `null` | FK a `auth.users` — quien ejecuto la accion |
| `action` | `text` | NO | — | Tipo de evento (ver abajo) |
| `description` | `text` | SI | `null` | Descripcion en lenguaje natural |
| `created_at` | `timestamptz` | NO | `now()` | Timestamp del evento |

### Tipos de action
| action | Disparado por |
|--------|--------------|
| `trip_created` | Trigger AFTER INSERT en trips |
| `trip_deleted` | Trigger AFTER DELETE en trips (SECURITY DEFINER) |
| `payment_created` | Trigger AFTER INSERT en payments |
| `payment_deleted` | Trigger AFTER DELETE en payments (SECURITY DEFINER) |
| `debt_settled` | Insertado manualmente desde `handleSettleDebtSubmit()` |

### Politicas RLS
- `SELECT`: solo miembros del vehiculo
- `INSERT`: solo miembros del vehiculo (y SECURITY DEFINER para triggers de DELETE)

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
Al eliminar un payment con `photo_url`, se extrae el path del URL y se intenta borrar del bucket. Si falla, el archivo queda huerfano (aceptado como trade-off — best effort).

---

## Funciones SQL Helper

### `is_vehicle_member(vid bigint)` → boolean

Verifica si el usuario logueado es miembro (owner o member) del vehiculo. Usada en todas las politicas RLS como gate.

```sql
SELECT EXISTS (
  SELECT 1 FROM public.vehicle_members
  WHERE vehicle_id = vid AND user_id = auth.uid()
);
```

### `is_vehicle_owner(vid bigint)` → boolean

Verifica si el usuario logueado es owner del vehiculo. Usada en politicas de UPDATE/DELETE sobre vehicles.

```sql
SELECT EXISTS (
  SELECT 1 FROM public.vehicle_members
  WHERE vehicle_id = vid AND user_id = auth.uid() AND role = 'owner'
);
```

### `join_vehicle_by_code(code text)` → jsonb (v16.2)

RPC que permite a un usuario unirse a un vehiculo mediante codigo de invitacion. Usa SECURITY DEFINER para bypassear RLS (el usuario aun no es miembro cuando ejecuta la funcion).

```sql
-- Retorna: { success: true, vehicle_id: N }
--       o: { success: false, error: '...' }
```

---

## Triggers de PostgreSQL

### Triggers de AFTER INSERT (Audit)

| Trigger | Tabla | Tipo | Funcion |
|---------|-------|------|---------|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` — crea perfil en `profiles` |
| `on_vehicle_created` | `vehicles` | AFTER INSERT | `handle_new_vehicle()` — inserta owner en `vehicle_members` |
| `on_trip_created_audit` | `trips` | AFTER INSERT | `audit_trip_insert()` — registra en `audit_logs` |
| `on_payment_created_audit` | `payments` | AFTER INSERT | `audit_payment_insert()` — registra en `audit_logs` |

### Triggers de BEFORE/AFTER DELETE (Cascade + Audit)

| Trigger | Tabla | Tipo | Funcion | Nota |
|---------|-------|------|---------|------|
| `on_trip_deleted` | `trips` | BEFORE DELETE | `cascade_delete_trip_ledger()` | Elimina ledger entries `trip_cost` con `ref_id=OLD.id` |
| `on_payment_deleted` | `payments` | BEFORE DELETE | `cascade_delete_payment_ledger()` | Elimina ledger entries `fuel_payment/transfer` con `ref_id=OLD.id` |
| `on_trip_deleted_audit` | `trips` | AFTER DELETE | `audit_trip_delete()` | Registra eliminacion en `audit_logs` (SECURITY DEFINER) |
| `on_payment_deleted_audit` | `payments` | AFTER DELETE | `audit_payment_delete()` | Registra eliminacion en `audit_logs` (SECURITY DEFINER) |

### Orden de ejecucion al eliminar un trip

```
1. BEFORE DELETE on trips → cascade_delete_trip_ledger() → DELETE FROM ledger WHERE ref_id=OLD.id
2. DELETE FROM trips ejecuta (fila eliminada)
3. AFTER DELETE on trips → audit_trip_delete() → INSERT INTO audit_logs (SECURITY DEFINER, bypass RLS)
```

---

## Indices

```sql
-- Indices creados automaticamente
-- (primary keys en todas las tablas)

-- Indices creados en migraciones

-- v16.0: Performance de RLS
CREATE INDEX idx_vehicle_members_user ON vehicle_members (user_id);
CREATE INDEX idx_vehicle_members_vehicle ON vehicle_members (vehicle_id);
CREATE INDEX idx_trips_vehicle_id ON trips (vehicle_id);
CREATE INDEX idx_payments_vehicle_id ON payments (vehicle_id);

-- v17.0: Ledger queries
CREATE INDEX idx_ledger_vehicle ON ledger (vehicle_id);
CREATE INDEX idx_ledger_driver ON ledger (vehicle_id, driver);
CREATE INDEX idx_ledger_type ON ledger (vehicle_id, type);

-- v18.5: Audit logs
CREATE INDEX idx_audit_logs_vehicle ON audit_logs (vehicle_id, created_at DESC);

-- Indices recomendados adicionales
CREATE INDEX idx_trips_created_at ON trips (created_at DESC);
CREATE INDEX idx_payments_created_at ON payments (created_at DESC);
CREATE INDEX idx_payments_full_tank ON payments (vehicle_id, is_full_tank)
  WHERE is_full_tank = true AND liters_loaded > 0;
```

---

## Row Level Security — Resumen de Politicas

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `vehicles` | miembro | `owner_id = auth.uid()` | owner | owner |
| `vehicle_members` | miembro | owner | — | owner o self |
| `trips` | miembro | miembro | miembro | miembro |
| `payments` | miembro | miembro | miembro | miembro |
| `ledger` | miembro | miembro | — | miembro (para cascade) |
| `profiles` | self | self | self | — |
| `vehicle_driver_mappings` | miembro | miembro | — | self |
| `audit_logs` | miembro | miembro (+ SECURITY DEFINER) | — | — |

**"miembro"** = `is_vehicle_member(vehicle_id) = true`
**"owner"** = `is_vehicle_owner(vehicle_id) = true`
**"self"** = `user_id = auth.uid()` o `id = auth.uid()`

---

## Archivos de Migracion

| Archivo | Version | Contenido |
|---------|---------|-----------|
| `supabase_v16_migration.sql` | v16.0 | Multi-tenant: owner_id en vehicles, tabla vehicle_members, funciones is_vehicle_member/owner, trigger on_vehicle_created, FK constraints, RLS en vehicles/trips/payments |
| `v16.2_invitations.sql` | v16.2 | invite_code en vehicles, funcion RPC join_vehicle_by_code |
| `v17.0_ledger_schema.sql` | v17.0 | Nuevas columnas en vehicles (current_ppp, virtual_liters, correction_factor, last_full_tank_at), tabla ledger, indices, RLS append-only |
| `v18.0_auth_and_mapping.sql` | v18.0 | Tabla profiles, trigger on_auth_user_created, tabla vehicle_driver_mappings, RLS |
| `v18.4_data_integrity.sql` | v18.4 | Limpieza de orphans en ledger, politica DELETE en ledger, triggers BEFORE DELETE para cascade (on_trip_deleted, on_payment_deleted) |
| `v18.5_audit_logs.sql` | v18.5 | Tabla audit_logs, triggers AFTER INSERT/DELETE en trips y payments, indice |

---

## Estado de Seguridad

### Estado actual (v18.22)

- **RLS habilitado** en todas las tablas desde v16.0
- **Auth obligatoria** para todas las operaciones desde v16.0 (politicas usan `authenticated` role)
- **Anon key** expuesta en el codigo fuente del frontend (riesgo de enumeracion)
- **Bucket `fuel-tickets`** sin restriccion de acceso a URLs publicas (cualquiera con la URL puede ver la foto)
- **Profiles** tienen RLS estricto (solo el propietario puede leer/modificar su perfil)

### Acceso anonimo vs autenticado

La anon key de Supabase solo puede leer/escribir datos que las politicas RLS permiten para el rol `anon`. Como todas las politicas de las tablas de datos usan `TO authenticated`, un usuario anonimo sin session no puede hacer nada. La unica excepcion son las funciones con `SECURITY DEFINER` que bypassean RLS.

### Recomendaciones pendientes

1. Restringir el bucket `fuel-tickets` a usuarios autenticados (actualmente publico)
2. Mover la anon key a variables de entorno en Vercel (actualmente hardcodeada en app.js)
3. Agregar rate limiting en las funciones SECURITY DEFINER para evitar abuso de `join_vehicle_by_code`
4. Evaluar politicas de retencion en `audit_logs` para evitar crecimiento ilimitado
