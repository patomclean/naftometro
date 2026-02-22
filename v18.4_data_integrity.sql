-- ============================================================
-- NAFTOMETRO v18.4 — Data Integrity: Orphan Cleanup + Cascade
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CLEANUP: Delete orphaned ledger entries
--    ref_id points to trips (type='trip_cost') or payments
--    (type='fuel_payment','transfer') that no longer exist.
-- ============================================================

-- Orphaned trip_cost entries
DELETE FROM public.ledger
WHERE type = 'trip_cost'
  AND ref_id IS NOT NULL
  AND ref_id NOT IN (SELECT id FROM public.trips);

-- Orphaned fuel_payment entries
DELETE FROM public.ledger
WHERE type = 'fuel_payment'
  AND ref_id IS NOT NULL
  AND ref_id NOT IN (SELECT id FROM public.payments);

-- Orphaned transfer entries (settlements reference payments)
DELETE FROM public.ledger
WHERE type = 'transfer'
  AND ref_id IS NOT NULL
  AND ref_id NOT IN (SELECT id FROM public.payments);

-- ============================================================
-- 2. RLS: Allow DELETE on ledger for vehicle members
--    (needed so cascade triggers can clean up via SECURITY DEFINER,
--     and for future direct cleanup if needed)
-- ============================================================

CREATE POLICY ledger_delete ON public.ledger FOR DELETE TO authenticated
  USING (public.is_vehicle_member(vehicle_id));

-- ============================================================
-- 3. CASCADE TRIGGERS: Auto-delete ledger rows when trip/payment
--    is deleted. Using triggers because ref_id is polymorphic
--    (no FK constraint possible).
-- ============================================================

-- 3a. Trigger on trips deletion
CREATE OR REPLACE FUNCTION public.cascade_delete_trip_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.ledger
  WHERE ref_id = OLD.id
    AND type = 'trip_cost';
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_trip_deleted
  BEFORE DELETE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_trip_ledger();

-- 3b. Trigger on payments deletion
CREATE OR REPLACE FUNCTION public.cascade_delete_payment_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.ledger
  WHERE ref_id = OLD.id
    AND type IN ('fuel_payment', 'transfer');
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_payment_deleted
  BEFORE DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_payment_ledger();

COMMIT;
