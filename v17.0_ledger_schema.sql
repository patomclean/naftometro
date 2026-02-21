-- ============================================================
-- NAFTOMETRO v17.0 — Ledger Continuo "Cuentas Claras"
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ALTER TABLE vehicles — Nuevas columnas financieras
-- ============================================================
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS current_ppp numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS virtual_liters numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS correction_factor numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS last_full_tank_at timestamptz;

COMMENT ON COLUMN public.vehicles.current_ppp IS 'Precio Promedio Ponderado actual del combustible en tanque';
COMMENT ON COLUMN public.vehicles.virtual_liters IS 'Litros estimados remanentes en tanque virtual';
COMMENT ON COLUMN public.vehicles.correction_factor IS 'Multiplicador de consumo real vs teorico (1.0 = teorico)';
COMMENT ON COLUMN public.vehicles.last_full_tank_at IS 'Timestamp de la ultima carga de tanque lleno';

-- ============================================================
-- 2. CREATE TABLE ledger — Libro contable inmutable
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ledger (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id  bigint      NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver      text        NOT NULL,
  type        text        NOT NULL
              CHECK (type IN ('trip_cost', 'fuel_payment', 'transfer', 'tank_audit_adjustment', 'opening_balance')),
  amount      numeric     NOT NULL,
  ref_id      bigint,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ledger IS 'Libro contable inmutable. Positivo = credito, negativo = debito. Append-only.';

-- ============================================================
-- 3. Indices para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ledger_vehicle ON public.ledger (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_ledger_driver ON public.ledger (vehicle_id, driver);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON public.ledger (vehicle_id, type);

-- ============================================================
-- 4. RLS para ledger (append-only: SELECT + INSERT, no UPDATE/DELETE)
-- ============================================================
ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY ledger_select ON public.ledger FOR SELECT TO authenticated
  USING (public.is_vehicle_member(vehicle_id));
CREATE POLICY ledger_insert ON public.ledger FOR INSERT TO authenticated
  WITH CHECK (public.is_vehicle_member(vehicle_id));

COMMIT;
