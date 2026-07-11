-- ============================================================
-- NAFTOMETRO v19.0 — MIGRACION DE DATOS: restateo modelo v2 (Taos)
-- ============================================================
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, UNA SOLA VEZ, DESPUES del
-- schema v19.0_modelo_v2_pool.sql y ANTES de deployar el codigo v19.0.
--
-- Que hace:
--  1. Inserta una entrada 'migration_v2' por piloto: el delta que lleva
--     su saldo actual (con las entradas corruptas de julio incluidas) al
--     saldo CORRECTO calculado con el modelo plata+km y el ancla fisica
--     del tanque lleno del 30-jun-2026 (Cerrito, 40 L a tope).
--     Guarda anti doble-ejecucion incluida.
--  2. Inicializa el pool: 32.73 L en el tanque hoy, pool_costo = suma
--     exacta del ledger post-restateo (invariante exacta por construccion),
--     km_l_aprendido = 9.90 (rinde real de ciclos cerrados).
--  3. Muestra la validacion: Σ ledger vs pool_costo deben ser IGUALES.
--
-- Saldos objetivo (auditables: pagado - km x $235/km):
--   PAPÁ  +182.797,76 | Pato  +93.090,82 | Belu   +56.062,88
--   Feli   -77.656,00 | Rafa  -38.110,49 | Marcos -139.685,97
--   Σ = +76.499 = valor a costo de la nafta que queda (32,73 L)
-- ============================================================

BEGIN;

-- 1) Restateo: delta por piloto (calculado contra el ledger VIVO)
WITH targets(driver, target) AS (
  VALUES
    ('PAPÁ',    182797.76),
    ('Pato',     93090.82),
    ('Belu',     56062.88),
    ('Feli',    -77656.00),
    ('Rafa',    -38110.49),
    ('Marcos', -139685.97)
),
live AS (
  SELECT driver, COALESCE(SUM(amount), 0) AS bal
  FROM public.ledger WHERE vehicle_id = 2 GROUP BY driver
)
INSERT INTO public.ledger (vehicle_id, driver, type, amount, description)
SELECT 2, t.driver, 'migration_v2',
       round((t.target - COALESCE(l.bal, 0))::numeric, 2),
       'Restateo modelo v2 (pool a costo): saldo corregido plata+km, ancla tanque lleno 30-jun-2026'
FROM targets t
LEFT JOIN live l ON l.driver = t.driver
WHERE abs(t.target - COALESCE(l.bal, 0)) > 0.01
  AND NOT EXISTS (
    SELECT 1 FROM public.ledger
    WHERE vehicle_id = 2 AND type = 'migration_v2' AND driver = t.driver
  );

-- 2) Inicializar el pool (pool_costo = Σ ledger exacta -> invariante exacta)
UPDATE public.vehicles SET
  pool_litros    = 32.73,
  pool_costo     = (SELECT round(SUM(amount)::numeric, 2) FROM public.ledger WHERE vehicle_id = 2),
  km_l_aprendido = 9.90
WHERE id = 2;

COMMIT;

-- 3) VALIDACION (correr después del COMMIT): las dos columnas deben ser iguales
SELECT
  (SELECT round(SUM(amount)::numeric, 2) FROM public.ledger WHERE vehicle_id = 2) AS suma_ledger,
  (SELECT pool_costo FROM public.vehicles WHERE id = 2)                            AS pool_costo,
  (SELECT pool_litros FROM public.vehicles WHERE id = 2)                           AS pool_litros;
