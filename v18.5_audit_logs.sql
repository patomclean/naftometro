-- ============================================================
-- NAFTOMETRO v18.5 — Audit Logs: Activity Tracking
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CREATE TABLE audit_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  bigint      NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES auth.users(id),
  action      text        NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_vehicle
  ON public.audit_logs (vehicle_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_vehicle_member(vehicle_id));

CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_vehicle_member(vehicle_id));

-- ============================================================
-- 2. AFTER INSERT triggers (without SECURITY DEFINER so
--    auth.uid() resolves to the calling user's session)
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_trip_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.audit_logs (vehicle_id, user_id, action, description)
  VALUES (
    NEW.vehicle_id,
    auth.uid(),
    'trip_created',
    'Registro un viaje de ' || NEW.km || 'km'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_trip_created_audit
  AFTER INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.audit_trip_insert();

-- ----

CREATE OR REPLACE FUNCTION public.audit_payment_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.audit_logs (vehicle_id, user_id, action, description)
  VALUES (
    NEW.vehicle_id,
    auth.uid(),
    'payment_created',
    'Cargo $' || NEW.amount || ' de nafta'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_created_audit
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_payment_insert();

-- ============================================================
-- 3. AFTER DELETE triggers (SECURITY DEFINER because the trip/
--    payment row that proved membership is already gone when
--    the AFTER DELETE fires, so RLS on audit_logs could block
--    the INSERT without the bypass).
--    Note: v18.4 BEFORE DELETE cascade triggers fire first
--    (cleanup ledger), then the row is deleted, then these
--    AFTER DELETE triggers fire — correct ordering.
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_trip_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.audit_logs (vehicle_id, user_id, action, description)
  VALUES (
    OLD.vehicle_id,
    auth.uid(),
    'trip_deleted',
    'Elimino un viaje de ' || OLD.km || 'km'
  );
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_trip_deleted_audit
  AFTER DELETE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.audit_trip_delete();

-- ----

CREATE OR REPLACE FUNCTION public.audit_payment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.audit_logs (vehicle_id, user_id, action, description)
  VALUES (
    OLD.vehicle_id,
    auth.uid(),
    'payment_deleted',
    'Elimino una carga de $' || OLD.amount
  );
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_payment_deleted_audit
  AFTER DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_payment_delete();

COMMIT;
