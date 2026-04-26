-- ============================================================
-- NAFTOMETRO vXX.Y — Titulo descriptivo del cambio
-- ============================================================
--
-- Descripcion breve: que hace esta migracion y por que.
-- Tablas afectadas: lista
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Cambios de schema (CREATE TABLE / ALTER TABLE)
-- ============================================================

-- Ejemplo: tabla nueva
CREATE TABLE IF NOT EXISTS public.nueva_tabla (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id  bigint      NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES auth.users(id),
  campo_text  text        NOT NULL,
  campo_num   numeric     DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nueva_tabla IS
  'Descripcion de para que sirve la tabla';

COMMENT ON COLUMN public.nueva_tabla.campo_num IS
  'Detalle de la unidad o significado, si no es obvio';

-- Indices
CREATE INDEX IF NOT EXISTS idx_nueva_tabla_vehicle
  ON public.nueva_tabla (vehicle_id, created_at DESC);

-- Ejemplo: ALTER en tabla existente
-- ALTER TABLE public.vehicles
--   ADD COLUMN IF NOT EXISTS nuevo_campo text DEFAULT '';

-- ============================================================
-- 2. Row Level Security (OBLIGATORIO en toda tabla nueva)
-- ============================================================

ALTER TABLE public.nueva_tabla ENABLE ROW LEVEL SECURITY;

CREATE POLICY nueva_tabla_select ON public.nueva_tabla FOR SELECT TO authenticated
  USING (public.is_vehicle_member(vehicle_id));

CREATE POLICY nueva_tabla_insert ON public.nueva_tabla FOR INSERT TO authenticated
  WITH CHECK (public.is_vehicle_member(vehicle_id));

-- Solo agregar UPDATE/DELETE si el caso de uso lo amerita.
-- El ledger NUNCA tiene UPDATE.
-- 
-- CREATE POLICY nueva_tabla_update ON public.nueva_tabla FOR UPDATE TO authenticated
--   USING (public.is_vehicle_member(vehicle_id));
-- 
-- CREATE POLICY nueva_tabla_delete ON public.nueva_tabla FOR DELETE TO authenticated
--   USING (public.is_vehicle_member(vehicle_id));

-- ============================================================
-- 3. Funciones y triggers (si aplica)
-- ============================================================

-- Ejemplo: funcion AFTER INSERT (sin SECURITY DEFINER, el user esta presente)
-- CREATE OR REPLACE FUNCTION public.audit_nueva_tabla_insert()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--   INSERT INTO public.audit_logs (vehicle_id, user_id, action, description)
--   VALUES (
--     NEW.vehicle_id,
--     auth.uid(),
--     'nueva_accion',
--     'Descripcion del evento'
--   );
--   RETURN NEW;
-- END;
-- $$;
--
-- CREATE TRIGGER on_nueva_tabla_inserted
--   AFTER INSERT ON public.nueva_tabla
--   FOR EACH ROW EXECUTE FUNCTION public.audit_nueva_tabla_insert();

-- Ejemplo: funcion AFTER DELETE (CON SECURITY DEFINER porque el row borrado
-- ya no permite verificar membership)
-- CREATE OR REPLACE FUNCTION public.audit_nueva_tabla_delete()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- BEGIN
--   INSERT INTO public.audit_logs (vehicle_id, user_id, action, description)
--   VALUES (
--     OLD.vehicle_id,
--     auth.uid(),
--     'borrado_de_x',
--     'Borro un X'
--   );
--   RETURN OLD;
-- END;
-- $$;
--
-- CREATE TRIGGER on_nueva_tabla_deleted
--   AFTER DELETE ON public.nueva_tabla
--   FOR EACH ROW EXECUTE FUNCTION public.audit_nueva_tabla_delete();

-- ============================================================
-- 4. RPC functions (si aplica) — typically con SECURITY DEFINER
--    cuando necesitan trascender RLS
-- ============================================================

-- Ejemplo:
-- CREATE OR REPLACE FUNCTION public.mi_rpc(param text)
-- RETURNS jsonb
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- BEGIN
--   -- ... logica ...
--   RETURN jsonb_build_object('success', true);
-- END;
-- $$;

COMMIT;

-- ============================================================
-- POST-DEPLOY
-- ============================================================
-- 1. Verificar en Table Editor que los cambios estan
-- 2. Probar con un usuario que NO sea owner (validar RLS)
-- 3. Commitear este archivo al repo
-- 4. Bumpear version del frontend si la app usa este cambio
-- ============================================================
