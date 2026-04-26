# naftometro-conventions — Changelog

Formato: [SemVer](https://semver.org/lang/es/). Fecha: AAAA-MM-DD.

## [1.0.0] — 2026-04-26

### Initial release
- Stack confirmado (vanilla JS, Supabase, sin frameworks/bundler)
- Estructura de archivos y `state` global documentado
- Las 3 vistas y sub-tabs explicados
- Tabla resumen de los 3 flujos (referencia a skill `naftometro-ledger-rules`)
- Patrones de código: queries Supabase, modales, renderizado, toast, formato moneda
- Sistema de diseño CSS y `PILOT_COLORS`
- Checklist de deploy (3 lugares de versión)
- Convenciones de naming
- Lista de antipatrones a evitar
- Referencias: `deploy-checklist.md`, `ios-gotchas.md`, `state-shape.md`

---

## Cómo actualizar esta skill

Cuando agregues una convención nueva o cambies algo del stack:

1. Editar `SKILL.md` y el reference correspondiente
2. Bumpear versión en el frontmatter de `SKILL.md` (`version: X.Y.Z`)
3. Agregar entrada en este changelog
4. Reempaquetar con `package_skill.py` (ver README del paquete)

### Cuándo es MAJOR vs MINOR vs PATCH

- **MAJOR (X.0.0)**: cambio en convenciones que rompe compatibilidad con código existente (ej: cambio de stack, decisión arquitectónica grande)
- **MINOR (1.X.0)**: nueva convención, nueva sección, referencia nueva
- **PATCH (1.0.X)**: typo, aclaración, corrección menor sin cambiar contenido sustantivo
