# naftometro-sql-migrations — Changelog

Formato: [SemVer](https://semver.org/lang/es/). Fecha: AAAA-MM-DD.

## [1.0.0] — 2026-04-26

### Initial release
- Naming convention para archivos `.sql` (`vXX.Y_descripcion.sql`)
- Estructura obligatoria con `BEGIN; ... COMMIT;`
- RLS como regla absoluta para toda tabla nueva
- Helpers existentes: `is_vehicle_member()`, `is_vehicle_owner()`
- Reglas de cuándo usar `SECURITY DEFINER` y cuándo no
- Patrón BEFORE-cascade / AFTER-audit para triggers
- FK polimórficas: usar triggers, no constraints
- Idempotencia con `IF NOT EXISTS` (excepto en `CREATE POLICY`)
- Checklist de 8 puntos antes de aplicar
- Procedimiento para reverse migrations
- Asset: `migration-template.sql` listo para copiar

---

## Cómo actualizar esta skill

Cuando se introduzca un patrón nuevo (helper SQL, convención, tipo de trigger):

1. Editar `SKILL.md` y/o `assets/migration-template.sql`
2. Bumpear versión
3. Entrada en este changelog
4. Reempaquetar

### MAJOR vs MINOR vs PATCH

- **MAJOR**: cambio en una regla absoluta (ej: deja de ser obligatorio el RLS — improbable)
- **MINOR**: helper SQL nuevo, patrón nuevo, sección nueva en el template
- **PATCH**: typo, aclaración, ejemplo nuevo
