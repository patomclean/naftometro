---
name: naftometro-sql-migrations
description: Conventions and template for writing SQL migrations for Naftometro's Supabase database. Use this skill whenever the task involves creating a new SQL migration file, adding a new table, modifying an existing table, writing RLS policies, creating triggers (especially with SECURITY DEFINER), adding RPC functions, or any DDL/DML change to the Postgres schema. Also load when the user mentions "v18.X" / "v19.X" or any new SQL file matching the `vXX.Y_descripcion.sql` pattern. This skill includes a ready-to-use template (`assets/migration-template.sql`) and the rules for RLS, helper functions, and trigger patterns that the codebase depends on. Loading it prevents writing migrations that violate naming conventions, miss RLS, or break existing cascade triggers.
metadata:
  version: 1.0.0
---

# Naftometro — SQL Migrations

Esta skill cubre cómo escribir migraciones SQL para el schema de Supabase de Naftometro siguiendo las convenciones existentes.

## Naming y ubicación

- Nombre del archivo: `vXX.Y_descripcion_corta.sql` (ej: `v18.5_audit_logs.sql`, `v19.0_recurring_trips.sql`)
- Ubicación: raíz del repo (junto a `app.js`, `index.html`)
- Versionado coordinado con el de la app — la migración va en la misma versión que la feature de frontend que la consume
- Quedan commiteadas en el repo aunque ya estén aplicadas (sirven de documentación e historia)

## Estructura obligatoria de toda migración

Toda migración va dentro de una transacción para que sea atómica. Si algo falla, no queda parcialmente aplicado.

```sql
-- ============================================================
-- NAFTOMETRO vXX.Y — Titulo descriptivo
-- ============================================================

BEGIN;

-- 1. Cambio principal
-- ...

-- 2. RLS policies (si aplica)
-- ...

-- 3. Triggers o funciones (si aplica)
-- ...

COMMIT;
```

Hay un template completo en `assets/migration-template.sql` — copiarlo como punto de partida.

## RLS: regla absoluta

**Toda tabla nueva en el schema `public` DEBE tener RLS habilitado.** No hay excepciones. Sin RLS, cualquier usuario puede leer/escribir todo.

```sql
ALTER TABLE public.nueva_tabla ENABLE ROW LEVEL SECURITY;

CREATE POLICY tabla_select ON public.nueva_tabla FOR SELECT TO authenticated
  USING (public.is_vehicle_member(vehicle_id));
CREATE POLICY tabla_insert ON public.nueva_tabla FOR INSERT TO authenticated
  WITH CHECK (public.is_vehicle_member(vehicle_id));
-- UPDATE y DELETE: agregar solo si el caso de uso lo amerita
```

## Helpers SQL existentes (usarlos siempre)

Estos helpers ya están definidos en migraciones anteriores. **No los redefinas.**

| Función | Retorna | Uso |
|---|---|---|
| `public.is_vehicle_member(vid)` | boolean | Toda RLS policy referenciada a `vehicle_id` |
| `public.is_vehicle_owner(vid)` | boolean | RLS de UPDATE/DELETE en `vehicles` |
| `auth.uid()` | uuid | El user actual (provista por Supabase) |

## SECURITY DEFINER: cuándo SÍ y cuándo NO

`SECURITY DEFINER` hace que la función se ejecute con los permisos del **dueño** de la función (típicamente `postgres`), no del usuario que la llama. **Evita las RLS** del usuario.

### Usar SECURITY DEFINER:

- **RPC functions que el cliente llama** y necesitan trascender RLS por una razón legítima:
  - `join_vehicle_by_code(code)` — necesita ver vehículos que el usuario aún NO es miembro
- **AFTER DELETE triggers que insertan en otra tabla**:
  - El usuario que borró un trip ya no es "miembro" del vehículo (porque el trip era la prueba), así que no podría insertar en `audit_logs` con sus permisos. SECURITY DEFINER lo permite.
  - Ejemplo: `audit_trip_delete()`, `audit_payment_delete()` en v18.5

### NO usar SECURITY DEFINER:

- AFTER INSERT triggers donde el usuario es claramente miembro al ejecutarse — usar funciones normales para que `auth.uid()` resuelva al usuario real
- Funciones que solo leen datos del usuario actual — RLS basta
- "Por las dudas" — es un riesgo de seguridad

## Triggers: BEFORE DELETE para cascade, AFTER para audit

Patrón actual del proyecto:

```sql
-- BEFORE DELETE: limpiar dependencias antes de que se borre el row
CREATE TRIGGER on_trip_deleted
  BEFORE DELETE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_trip_ledger();

-- AFTER DELETE: registrar que sucedió (con SECURITY DEFINER en la función)
CREATE TRIGGER on_trip_deleted_audit
  AFTER DELETE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.audit_trip_delete();
```

El orden importa: BEFORE corre primero (limpia), luego se borra el row, luego AFTER (audit). Si invertís el orden, `audit_trip_delete()` no va a poder leer `OLD.vehicle_id` para verificar membresía — pero como tiene SECURITY DEFINER, igual funciona. Aún así, mantené el patrón BEFORE-cascade / AFTER-audit por claridad.

## FK polimórficas: usar triggers, no FK constraints

La columna `ledger.ref_id` apunta a `trips.id` o `payments.id` según el `type`. **No se puede** poner una FK constraint normal porque PostgreSQL no soporta FKs polimórficas. La solución actual:

- Sin FK constraint
- Cascade triggers manuales que filtran por `type` y borran las entradas de ledger correspondientes (ver `v18.4_data_integrity.sql`)

Si agregás un nuevo `type` que use `ref_id`, **acordate de extender el cascade trigger** o vas a generar entradas huérfanas.

## ALTER TABLE: usar IF NOT EXISTS para idempotencia

Las migraciones se ejecutan manualmente (no hay sistema automático que las trackee), por lo que tienen que tolerar que se corran 2 veces sin romper:

```sql
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS new_field text DEFAULT '...';

CREATE TABLE IF NOT EXISTS public.new_table (...);

CREATE INDEX IF NOT EXISTS idx_xxx ON public.tabla(col);
```

**NO uses `IF NOT EXISTS` en `CREATE POLICY`** — PostgreSQL no lo soporta. Si necesitás re-ejecutar una migración que crea policies, hacé `DROP POLICY IF EXISTS ... ; CREATE POLICY ...`.

## Comments en columnas importantes

Para columnas con lógica especial (PPP, factor de corrección, etc.), agregar `COMMENT ON COLUMN`:

```sql
COMMENT ON COLUMN public.vehicles.current_ppp IS 
  'Precio Promedio Ponderado actual del combustible en tanque';
```

Esto aparece en el dashboard de Supabase y ayuda a quien lea el schema más adelante.

## Checklist antes de aplicar la migración

1. ¿La migración está dentro de `BEGIN; ... COMMIT;`?
2. Si crea tabla nueva: ¿tiene RLS habilitado y al menos SELECT/INSERT policies?
3. Si crea policies: ¿usan `is_vehicle_member()` o `is_vehicle_owner()` correctamente?
4. Si crea trigger AFTER DELETE que inserta: ¿la función tiene `SECURITY DEFINER`?
5. Si modifica `ledger`: ¿NO agrega política UPDATE? (regla de oro — ver skill `naftometro-ledger-rules`)
6. Si agrega columna a tabla existente: ¿tiene `DEFAULT` para no romper rows existentes?
7. Si referencia un nuevo `type` en `ledger`: ¿extendiste el cascade trigger correspondiente?
8. ¿Es idempotente? (probar correrla 2 veces seguidas sin error)

## Aplicar la migración

1. Copiar el SQL al SQL Editor de Supabase Dashboard
2. Ejecutar — debe terminar sin errores
3. Verificar en `Table Editor` que el cambio quedó aplicado
4. **Probar con un usuario que NO es owner** del vehículo — verifica que las RLS funcionan
5. Commit del archivo `.sql` al repo
6. Si la app usa el cambio, deploy del frontend (ver `naftometro-conventions` → checklist de deploy)

## Reverse migrations

No hay sistema de rollback automático. Si una migración rompe algo, escribí una migración nueva (`vXX.Y_revert_yyy.sql`) que la deshaga. Ejemplos:

```sql
-- Para revertir un ADD COLUMN:
ALTER TABLE public.vehicles DROP COLUMN IF EXISTS bad_column;

-- Para revertir un CREATE POLICY:
DROP POLICY IF EXISTS bad_policy ON public.tabla;

-- Para revertir un CREATE TRIGGER:
DROP TRIGGER IF EXISTS bad_trigger ON public.tabla;
DROP FUNCTION IF EXISTS public.bad_function();
```

## Referencias adicionales

- `assets/migration-template.sql` — template completo, copiar y completar
