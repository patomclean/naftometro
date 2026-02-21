-- ============================================================
-- NAFTOMETRO v16.2 — Invitation Codes for Vehicle Sharing
-- ============================================================

BEGIN;

-- 1. Add invite_code column to vehicles
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

-- 2. Function: join_vehicle_by_code(code text)
--    Allows an authenticated user to join a vehicle by invitation code
CREATE OR REPLACE FUNCTION public.join_vehicle_by_code(code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id bigint;
BEGIN
  -- Find the vehicle with this invite code
  SELECT id INTO v_id
  FROM public.vehicles
  WHERE invite_code = code;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Codigo de invitacion invalido');
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM public.vehicle_members
    WHERE vehicle_id = v_id AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya sos miembro de este vehiculo');
  END IF;

  -- Insert the user as a member
  INSERT INTO public.vehicle_members (vehicle_id, user_id, role)
  VALUES (v_id, auth.uid(), 'member');

  RETURN jsonb_build_object('success', true, 'vehicle_id', v_id);
END;
$$;

COMMIT;
