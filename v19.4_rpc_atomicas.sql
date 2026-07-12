-- ============================================================
-- NAFTOMETRO v19.4 — RPCs atomicas para el modelo pool
-- ============================================================
--
-- Motivacion (2 problemas que resuelve):
--
-- 1) ATOMICIDAD: registrar un viaje/carga eran 3 writes separados desde el
--    cliente (insert + ledger + pool). Un corte de red a mitad de camino
--    dejaba la invariante SUM(ledger) = pool_costo rota en silencio.
--    Ahora cada operacion es UNA transaccion: o pasa todo o no pasa nada.
--
-- 2) RLS: la policy vehicles_update es is_vehicle_owner(id) — un MIEMBRO
--    no-dueño que registraba un viaje insertaba el trip y el ledger, pero
--    el UPDATE del pool fallaba por RLS => invariante rota. Estas funciones
--    son SECURITY DEFINER (justificado: necesitan trascender esa policy)
--    con guardia explicita is_vehicle_member() al inicio — un no-miembro
--    recibe excepcion, nunca toca datos.
--
-- El cliente (app.js v19.4) llama estas RPCs con FALLBACK al camino legacy
-- si la funcion no existe todavia — el orden deploy-codigo / correr-SQL es
-- indistinto, pero hasta correr este script los miembros no-dueño siguen
-- limitados. Idempotente: se puede correr 2 veces sin error.

BEGIN;

-- ------------------------------------------------------------
-- 1. apply_pool_delta — unico punto de mutacion del pool
--    (usado por borrados, ediciones y limpieza de viajes)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_pool_delta(
  p_vehicle_id bigint,
  p_delta_litros numeric,
  p_delta_costo numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_vehicle_member(p_vehicle_id) THEN
    RAISE EXCEPTION 'No sos miembro de este vehiculo';
  END IF;
  UPDATE public.vehicles
     SET pool_litros = ROUND(COALESCE(pool_litros, 0) + p_delta_litros, 2),
         pool_costo  = ROUND(COALESCE(pool_costo, 0)  + p_delta_costo, 2)
   WHERE id = p_vehicle_id;
END;
$$;

-- ------------------------------------------------------------
-- 2. set_pool_anchor — reanclaje del pool en la reconciliacion
--    (performTankAudit: pool a capacidad + rinde aprendido + fecha)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_pool_anchor(
  p_vehicle_id bigint,
  p_pool_litros numeric,
  p_pool_costo numeric,
  p_km_l numeric DEFAULT NULL,
  p_last_full_tank_at timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_vehicle_member(p_vehicle_id) THEN
    RAISE EXCEPTION 'No sos miembro de este vehiculo';
  END IF;
  UPDATE public.vehicles
     SET pool_litros = ROUND(p_pool_litros, 2),
         pool_costo  = ROUND(p_pool_costo, 2),
         km_l_aprendido    = COALESCE(p_km_l, km_l_aprendido),
         last_full_tank_at = COALESCE(p_last_full_tank_at, last_full_tank_at)
   WHERE id = p_vehicle_id;
END;
$$;

-- ------------------------------------------------------------
-- 3. register_trip_v2 — viaje completo en UNA transaccion:
--    trip + ledger(trip_cost) + pool(-litros, -costo)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_trip_v2(
  p_vehicle_id bigint,
  p_driver text,
  p_km numeric,
  p_liters numeric,
  p_cost numeric,
  p_drive_type text,
  p_note text,
  p_occurred_at timestamptz
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trip_id bigint;
BEGIN
  IF NOT public.is_vehicle_member(p_vehicle_id) THEN
    RAISE EXCEPTION 'No sos miembro de este vehiculo';
  END IF;
  IF p_km <= 0 OR p_cost < 0 OR p_liters < 0 THEN
    RAISE EXCEPTION 'Valores invalidos para el viaje';
  END IF;

  INSERT INTO public.trips (vehicle_id, driver, km, liters, cost, drive_type, note, occurred_at)
  VALUES (p_vehicle_id, p_driver, p_km, p_liters, p_cost, p_drive_type, p_note, p_occurred_at)
  RETURNING id INTO v_trip_id;

  INSERT INTO public.ledger (vehicle_id, driver, type, amount, ref_id, description)
  VALUES (p_vehicle_id, p_driver, 'trip_cost', -p_cost, v_trip_id,
          'Viaje ' || p_km || ' km (' || p_drive_type || ')');

  UPDATE public.vehicles
     SET pool_litros = ROUND(COALESCE(pool_litros, 0) - p_liters, 2),
         pool_costo  = ROUND(COALESCE(pool_costo, 0)  - p_cost, 2)
   WHERE id = p_vehicle_id;

  RETURN v_trip_id;
END;
$$;

-- ------------------------------------------------------------
-- 4. register_fuel_payment_v2 — carga completa en UNA transaccion:
--    payment + ledger(fuel_payment, neto de descuento) + pool(+litros, +neto)
--    (+ last_full_tank_at si fue tanque lleno)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_fuel_payment_v2(
  p_vehicle_id bigint,
  p_driver text,
  p_amount numeric,
  p_liters numeric,
  p_price_per_liter numeric,
  p_is_full_tank boolean,
  p_invoice_type text,
  p_tax_perceptions numeric,
  p_discount numeric,
  p_note text,
  p_photo_url text,
  p_occurred_at timestamptz
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment_id bigint;
  v_neto numeric;
BEGIN
  IF NOT public.is_vehicle_member(p_vehicle_id) THEN
    RAISE EXCEPTION 'No sos miembro de este vehiculo';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a cero';
  END IF;

  v_neto := ROUND(p_amount - COALESCE(p_discount, 0), 2);

  INSERT INTO public.payments (vehicle_id, driver, amount, liters_loaded, price_per_liter,
                               is_full_tank, invoice_type, tax_perceptions, discount_amount,
                               note, photo_url, occurred_at)
  VALUES (p_vehicle_id, p_driver, p_amount, p_liters, p_price_per_liter,
          COALESCE(p_is_full_tank, false), p_invoice_type, COALESCE(p_tax_perceptions, 0),
          COALESCE(p_discount, 0), p_note, p_photo_url, p_occurred_at)
  RETURNING id INTO v_payment_id;

  INSERT INTO public.ledger (vehicle_id, driver, type, amount, ref_id, description)
  VALUES (p_vehicle_id, p_driver, 'fuel_payment', v_neto, v_payment_id,
          CASE WHEN COALESCE(p_liters, 0) > 0
               THEN 'Carga ' || p_liters || ' lts'
               ELSE 'Pago combustible' END);

  IF COALESCE(p_liters, 0) > 0 THEN
    UPDATE public.vehicles
       SET pool_litros = ROUND(COALESCE(pool_litros, 0) + p_liters, 2),
           pool_costo  = ROUND(COALESCE(pool_costo, 0)  + v_neto, 2),
           last_full_tank_at = CASE WHEN COALESCE(p_is_full_tank, false)
                                    THEN p_occurred_at ELSE last_full_tank_at END
     WHERE id = p_vehicle_id;
  END IF;

  RETURN v_payment_id;
END;
$$;

-- ------------------------------------------------------------
-- 5. Permisos: solo usuarios autenticados
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.apply_pool_delta(bigint, numeric, numeric) FROM anon, public;
REVOKE ALL ON FUNCTION public.set_pool_anchor(bigint, numeric, numeric, numeric, timestamptz) FROM anon, public;
REVOKE ALL ON FUNCTION public.register_trip_v2(bigint, text, numeric, numeric, numeric, text, text, timestamptz) FROM anon, public;
REVOKE ALL ON FUNCTION public.register_fuel_payment_v2(bigint, text, numeric, numeric, numeric, boolean, text, numeric, numeric, text, text, timestamptz) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.apply_pool_delta(bigint, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_pool_anchor(bigint, numeric, numeric, numeric, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_trip_v2(bigint, text, numeric, numeric, numeric, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_fuel_payment_v2(bigint, text, numeric, numeric, numeric, boolean, text, numeric, numeric, text, text, timestamptz) TO authenticated;

COMMIT;
