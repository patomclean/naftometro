-- ============================================================
-- NAFTOMETRO v19.0 — Modelo Financiero v2: Pool a costo (WAC)
-- ============================================================
--
-- Reemplaza el nucleo PPP+correction_factor por el pool a costo:
-- el tanque guarda litros + costo real; precio de viaje =
-- pool_costo / pool_litros (promedio ponderado a costo).
-- Diseno y decisiones: docs/05 (§10) · Plan: docs/06.
--
-- Tablas afectadas: vehicles (3 columnas nuevas), ledger (nuevo type).
-- NO se borra ni edita nada existente (ledger append-only intacto;
-- current_ppp / virtual_liters / correction_factor quedan DEPRECADOS,
-- el codigo v19 no los lee ni escribe).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. vehicles — el pool (unica fuente de verdad del tanque)
-- ============================================================

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS pool_litros    numeric,
  ADD COLUMN IF NOT EXISTS pool_costo     numeric,
  ADD COLUMN IF NOT EXISTS km_l_aprendido numeric;

COMMENT ON COLUMN public.vehicles.pool_litros IS
  'Litros actualmente en el tanque (modelo v2). NULL = vehiculo no migrado.';
COMMENT ON COLUMN public.vehicles.pool_costo IS
  'Costo real pagado por los litros del pool. Invariante: SUM(ledger.amount) = pool_costo.';
COMMENT ON COLUMN public.vehicles.km_l_aprendido IS
  'Rinde real aprendido (km/l) de ciclos cerrados tanque lleno->lleno. Reemplaza a correction_factor.';

COMMENT ON COLUMN public.vehicles.current_ppp IS
  'DEPRECADO desde v19.0 (modelo v2). No usar. Reemplazado por pool_costo/pool_litros.';
COMMENT ON COLUMN public.vehicles.virtual_liters IS
  'DEPRECADO desde v19.0 (modelo v2). No usar. Reemplazado por pool_litros.';
COMMENT ON COLUMN public.vehicles.correction_factor IS
  'DEPRECADO desde v19.0 (modelo v2). No usar. Reemplazado por km_l_aprendido.';

-- ============================================================
-- 2. ledger — nuevo type para el restateo de la migracion
-- ============================================================
-- 'migration_v2': delta por piloto que lleva del saldo viejo al saldo
-- correcto (modelo plata+km con ancla fisica). Se inserta UNA vez por
-- piloto por vehiculo en la migracion de datos. Append-only respetado.

ALTER TABLE public.ledger DROP CONSTRAINT IF EXISTS ledger_type_check;
ALTER TABLE public.ledger ADD CONSTRAINT ledger_type_check
  CHECK (type = ANY (ARRAY[
    'trip_cost'::text,
    'fuel_payment'::text,
    'transfer'::text,
    'tank_audit_adjustment'::text,
    'opening_balance'::text,
    'migration_v2'::text
  ]));

COMMIT;

-- ============================================================
-- POST-DEPLOY
-- ============================================================
-- 1. Verificar columnas nuevas en Table Editor (NULL en todos los vehiculos).
-- 2. Este schema es INERTE para el codigo v18.x (no lee pool_*).
-- 3. La migracion de DATOS (calculo de saldos + insert migration_v2 +
--    seteo del pool) se ejecuta por separado, inmediatamente antes del
--    deploy del codigo v19.0. Ver docs/06 §3.
-- ============================================================
