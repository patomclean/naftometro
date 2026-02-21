-- ============================================================
-- NAFTOMETRO v16.0 — Multi-Tenant SaaS Migration (CORREGIDO)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ALTER TABLE vehicles — agregar owner_id
-- ============================================================
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- 2. CREATE TABLE vehicle_members
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vehicle_members (
  vehicle_id  bigint      NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner', 'member')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vehicle_id, user_id)
);

COMMENT ON TABLE public.vehicle_members IS 'Membresias de vehiculos. Un usuario puede ser owner o member.';

-- ============================================================
-- 3. HELPER FUNCTION: is_vehicle_member
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_vehicle_member(vid bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vehicle_members
    WHERE vehicle_id = vid
      AND user_id = auth.uid()
  );
$$;

-- ============================================================
-- 4. HELPER FUNCTION: is_vehicle_owner
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_vehicle_owner(vid bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vehicle_members
    WHERE vehicle_id = vid
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;

-- ============================================================
-- 5. FOREIGN KEY CONSTRAINTS (trips y payments)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_trips_vehicle' AND table_name = 'trips'
  ) THEN
    ALTER TABLE public.trips ADD CONSTRAINT fk_trips_vehicle FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_payments_vehicle' AND table_name = 'payments'
  ) THEN
    ALTER TABLE public.payments ADD CONSTRAINT fk_payments_vehicle FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 6. TRIGGER: Auto-insert owner en vehicle_members
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_vehicle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.vehicle_members (vehicle_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (vehicle_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_vehicle_created ON public.vehicles;

CREATE TRIGGER on_vehicle_created
  AFTER INSERT ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_vehicle();

-- ============================================================
-- 7. INDICES para performance de RLS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_vehicle_members_user ON public.vehicle_members (user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_members_vehicle ON public.vehicle_members (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON public.trips (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_payments_vehicle_id ON public.payments (vehicle_id);

-- ============================================================
-- 8. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.vehicles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. RLS POLICIES
-- ============================================================
-- vehicles
CREATE POLICY vehicles_select ON public.vehicles FOR SELECT TO authenticated USING (public.is_vehicle_member(id));
CREATE POLICY vehicles_insert ON public.vehicles FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY vehicles_update ON public.vehicles FOR UPDATE TO authenticated USING (public.is_vehicle_owner(id)) WITH CHECK (public.is_vehicle_owner(id));
CREATE POLICY vehicles_delete ON public.vehicles FOR DELETE TO authenticated USING (public.is_vehicle_owner(id));

-- vehicle_members
CREATE POLICY members_select ON public.vehicle_members FOR SELECT TO authenticated USING (public.is_vehicle_member(vehicle_id));
CREATE POLICY members_insert ON public.vehicle_members FOR INSERT TO authenticated WITH CHECK (public.is_vehicle_owner(vehicle_id));
CREATE POLICY members_delete ON public.vehicle_members FOR DELETE TO authenticated USING (public.is_vehicle_owner(vehicle_id) OR user_id = auth.uid());

-- trips
CREATE POLICY trips_select ON public.trips FOR SELECT TO authenticated USING (public.is_vehicle_member(vehicle_id));
CREATE POLICY trips_insert ON public.trips FOR INSERT TO authenticated WITH CHECK (public.is_vehicle_member(vehicle_id));
CREATE POLICY trips_update ON public.trips FOR UPDATE TO authenticated USING (public.is_vehicle_member(vehicle_id)) WITH CHECK (public.is_vehicle_member(vehicle_id));
CREATE POLICY trips_delete ON public.trips FOR DELETE TO authenticated USING (public.is_vehicle_member(vehicle_id));

-- payments
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated USING (public.is_vehicle_member(vehicle_id));
CREATE POLICY payments_insert ON public.payments FOR INSERT TO authenticated WITH CHECK (public.is_vehicle_member(vehicle_id));
CREATE POLICY payments_update ON public.payments FOR UPDATE TO authenticated USING (public.is_vehicle_member(vehicle_id)) WITH CHECK (public.is_vehicle_member(vehicle_id));
CREATE POLICY payments_delete ON public.payments FOR DELETE TO authenticated USING (public.is_vehicle_member(vehicle_id));

COMMIT;