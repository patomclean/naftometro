# Naftometro Skills

Paquete de 3 skills para trabajar eficientemente en el proyecto **Naftometro** (https://github.com/patomclean/naftometro). Diseñadas para que cualquier nueva conversación con Claude tenga el contexto del proyecto sin re-explicarlo.

## Skills incluidas

| Skill | Versión | Para qué sirve |
|---|---|---|
| `naftometro-conventions` | 1.0.0 | Stack, estructura de archivos, patrones de código, checklist de deploy, sistema de diseño |
| `naftometro-ledger-rules` | 1.0.0 | Reglas inmutables del ledger, tipos válidos, los 3 flujos financieros (Reconciliación / Settlement / Identity) |
| `naftometro-sql-migrations` | 1.0.0 | Convenciones para migraciones SQL, RLS, triggers, template listo |

Las skills se cargan automáticamente cuando Claude detecta que la tarea las amerita — no hay que invocarlas manualmente.

---

## Instalación

### Opción A: Claude.ai (web/mobile/desktop)

1. Empaquetar cada skill como `.skill` (ya están empaquetadas — buscar los `.skill` adjuntos junto a este README)
2. Ir a Settings → Skills (o "Capabilities") en claude.ai
3. Subir cada `.skill` individualmente
4. Activarlas

> Si Anthropic todavía no expuso skills personales en el UI de Claude.ai al momento de leer esto, los archivos `.skill` se pueden subir como adjuntos en una conversación nueva con la indicación: *"instalá esta skill"* — pero este flujo cambia rápido. Lo más confiable es usar Claude Code.

### Opción B: Claude Code (terminal local)

Claude Code lee skills desde varias ubicaciones. La más portable:

```bash
# Crear el directorio de skills (si no existe)
mkdir -p ~/.claude/skills

# Copiar cada skill
cp -r naftometro-conventions ~/.claude/skills/
cp -r naftometro-ledger-rules ~/.claude/skills/
cp -r naftometro-sql-migrations ~/.claude/skills/
```

Alternativa para uso solo en el repo de Naftometro: meter las carpetas dentro del repo en `.claude/skills/` y commitearlas. Así también colaboran si en algún momento sumás a otra persona al proyecto.

```bash
cd ~/path/to/naftometro
mkdir -p .claude/skills
cp -r ~/path/to/this/package/naftometro-* .claude/skills/
git add .claude/skills/
git commit -m "feat: agregar skills del proyecto para Claude"
```

Reiniciar Claude Code después de copiar para que detecte las skills nuevas.

### Verificar que están cargadas

En una conversación nueva, preguntale a Claude:

> ¿Qué skills de Naftometro tenés disponibles?

Debería mencionar las 3.

---

## Cómo actualizar una skill

El proyecto va a evolucionar. Para mantener las skills al día sin perder historia:

1. **Editar la skill** correspondiente — modificar `SKILL.md` y/o sus referencias
2. **Bumpear la versión** en el frontmatter del `SKILL.md`:
   ```yaml
   ---
   name: naftometro-conventions
   description: ...
   metadata:
     version: 1.1.0   # ← bump aquí
   ---
   ```
3. **Actualizar el `CHANGELOG.md`** de esa skill con la entrada nueva
4. **Reempaquetar** (ver abajo) si vas a redistribuirla o subirla a Claude.ai
5. **Reinstalar** en Claude Code (o re-subir el `.skill` en Claude.ai)

### Versionado semántico aplicado a skills

- **MAJOR (`X.0.0`)**: cambio que invalida supuestos previos (ej: stack cambia, regla inmutable cambia)
- **MINOR (`1.X.0`)**: contenido nuevo, sección nueva, regla nueva no contradictoria
- **PATCH (`1.0.X`)**: typo, aclaración, ejemplo

Cuando bumpeás MAJOR, conviene avisarle a Claude al inicio de la siguiente sesión: *"actualicé la skill `naftometro-conventions` a 2.0.0, ahora la convención X cambió"*.

---

## Reempaquetar para Claude.ai

Si tenés Python y el script `package_skill.py` del skill-creator de Anthropic:

```bash
python -m scripts.package_skill ./naftometro-conventions
python -m scripts.package_skill ./naftometro-ledger-rules
python -m scripts.package_skill ./naftometro-sql-migrations
```

Cada uno produce un archivo `.skill` (es un zip renombrado) listo para subir a Claude.ai.

Si no tenés ese script: un `.skill` es simplemente un `.zip` de la carpeta de la skill. Podés zippearlo manualmente:

```bash
cd naftometro-conventions && zip -r ../naftometro-conventions.skill . && cd ..
```

---

## Estructura de cada skill

Todas siguen el formato estándar de Anthropic:

```
naftometro-<nombre>/
├── SKILL.md           ← obligatorio. Frontmatter YAML + cuerpo markdown
├── CHANGELOG.md       ← historial de versiones
├── references/        ← documentos cargados solo cuando hagan falta
│   └── *.md
└── assets/            ← recursos (templates, ejemplos, etc.)
    └── *
```

El `SKILL.md` es lo que Claude carga al activar la skill. Los archivos en `references/` y `assets/` solo se cargan cuando el `SKILL.md` los referencia explícitamente y Claude decide que los necesita — esto es "progressive disclosure" y mantiene el costo de tokens bajo.

---

## Notas

- Las descriptions de cada skill están escritas para **forzar el triggering** cuando se mencionen los términos del proyecto. Si notás que Claude no las usa cuando debería, editá la `description` para incluir el término que faltó disparar.
- Las 3 skills son independientes pero se referencian entre sí cuando aplica. No hay que cargar todas siempre.
- Si agregás una skill nueva al paquete, sumá la entrada en la tabla de arriba y al instalador.
