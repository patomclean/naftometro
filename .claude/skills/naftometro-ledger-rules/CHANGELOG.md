# naftometro-ledger-rules — Changelog

Formato: [SemVer](https://semver.org/lang/es/). Fecha: AAAA-MM-DD.

## [1.1.0] — 2026-06-07

### Added
- Guardas defensivas del PPP (v18.15 de la app) en la sección de fórmulas:
  clamp de `oldLiters`, saneo de `oldPPP`, piso de `newPPP`.
- Nota sobre `clampTankLiters()` en los 3 writes de `virtual_liters`.
- Advertencia: `handleDeleteTrip()` debe devolver los litros al borrar un viaje
  (bug corregido en v18.15 que causaba corrupción del PPP).

## [1.0.0] — 2026-04-26

### Initial release
- Regla de oro: ledger es append-only
- Estructura completa de la tabla `ledger`
- Convención del signo de `amount` (+ crédito, − débito)
- Documentación de los 5 tipos: `trip_cost`, `fuel_payment`, `transfer`, `tank_audit_adjustment`, `opening_balance`
- Reglas específicas por tipo (cuándo se inserta, signo esperado, ref_id)
- Tabla comparativa de los 3 flujos (Reconciliación / Settlement / Identity Claim)
- Fórmulas: PPP, costo de viaje, factor de reconciliación
- Antipatrones que rompen el ledger
- Procedimiento para agregar un type nuevo

---

## Cómo actualizar esta skill

Cuando se agregue/modifique un tipo de ledger entry, una regla, o un flujo:

1. Editar `SKILL.md`
2. Bumpear versión en frontmatter
3. Entrada nueva en este changelog
4. Reempaquetar

### MAJOR vs MINOR vs PATCH

- **MAJOR**: cambio en una regla inmutable (ej: el ledger ya no es append-only — espero que nunca pase)
- **MINOR**: nuevo tipo de ledger entry, nuevo flujo financiero, nueva fórmula
- **PATCH**: aclaración, fix de typo, ejemplo nuevo
