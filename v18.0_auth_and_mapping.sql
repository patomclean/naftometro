-- ============================================================
-- NAFTOMETRO v18.0 — Profiles, Driver Mappings, Email Auth
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CREATE TABLE profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name         text,
  currency             text NOT NULL DEFAULT 'ARS',
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'User profiles with display name and preferences';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 2. Trigger: auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. CREATE TABLE vehicle_driver_mappings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vehicle_driver_mappings (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id  bigint NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id     uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_name text   NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, user_id),
  UNIQUE (vehicle_id, driver_name)
);

COMMENT ON TABLE public.vehicle_driver_mappings IS 'Links auth users to text-based driver names per vehicle (Tricount-style avatar claim)';

ALTER TABLE public.vehicle_driver_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY mappings_select ON public.vehicle_driver_mappings FOR SELECT TO authenticated
  USING (public.is_vehicle_member(vehicle_id));
CREATE POLICY mappings_insert ON public.vehicle_driver_mappings FOR INSERT TO authenticated
  WITH CHECK (public.is_vehicle_member(vehicle_id));
CREATE POLICY mappings_delete ON public.vehicle_driver_mappings FOR DELETE TO authenticated
  USING (user_id = auth.uid());

COMMIT;
