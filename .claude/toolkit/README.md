# Naftometro Skill Toolkit

Paquete portátil con todo lo necesario para usar, mantener y crear skills de Claude para el proyecto **Naftometro**.

> 🎒 **Diseñado para mudarse entre máquinas.** Funciona en Linux, macOS y Windows. Solo requiere Python 3.10+.

---

## 📦 Qué incluye

```
naftometro-skill-toolkit/
├── setup.sh                  ← Instalador (Linux/macOS)
├── setup.ps1                 ← Instalador (Windows)
├── requirements.txt          ← Dependencias Python (pyyaml únicamente)
│
├── naftometro-conventions/   ← Skill 1
├── naftometro-ledger-rules/  ← Skill 2
├── naftometro-sql-migrations/← Skill 3
│
├── bin/
│   ├── repackage.sh / .ps1   ← Empaqueta una skill como .skill
│   └── new-skill.sh          ← Scaffold para crear skills nuevas
│
├── tools/
│   ├── scripts/              ← Scripts de Anthropic (validate, package)
│   ├── skill-creator-reference/ ← Documentación oficial del skill-creator
│   └── LICENSE.txt           ← Apache 2.0 (de Anthropic)
│
├── dist/                     ← Acá aparecen los .skill generados
└── SKILLS-README.md          ← README detallado de las skills
```

---

## 🚀 Instalación rápida (en máquina nueva)

### Pre-requisitos
- **Python 3.10+** (`python3 --version`). En Windows: instalar desde [python.org](https://python.org) marcando "Add to PATH".
- **Claude Code** (opcional pero recomendado). Si no lo tenés, las skills igual sirven subiendo los `.skill` a Claude.ai.

### Pasos

**Linux / macOS:**
```bash
unzip naftometro-skill-toolkit.zip
cd naftometro-skill-toolkit
./setup.sh
```

**Windows (PowerShell):**
```powershell
Expand-Archive naftometro-skill-toolkit.zip
cd naftometro-skill-toolkit
.\setup.ps1
```

> Si Windows bloquea el script, ejecutar primero:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

El instalador:
1. Verifica Python 3
2. Instala `pyyaml` (única dependencia)
3. Copia las 3 skills a `~/.claude/skills/` (Linux/macOS) o `%USERPROFILE%\.claude\skills\` (Windows)

Después, **reiniciá Claude Code** para que detecte las skills.

---

## 🔄 Workflow del día a día

### Verificar qué skills tenés instaladas
En una conversación con Claude:
> ¿Qué skills de Naftometro tenés disponibles?

### Editar una skill existente
1. Abrir el archivo: `naftometro-conventions/SKILL.md` (o las referencias en `references/`)
2. Hacer cambios + bumpear `metadata.version` en el frontmatter
3. Agregar entrada en el `CHANGELOG.md` de esa skill
4. Validar y reinstalar:
   ```bash
   ./bin/repackage.sh naftometro-conventions
   ```
   El script valida → empaqueta → reinstala en `~/.claude/skills/` automáticamente.
5. Reiniciar Claude Code.

### Crear una skill nueva
```bash
./bin/new-skill.sh naftometro-charts
```
Esto crea la estructura básica con un `SKILL.md` template y un `CHANGELOG.md`. Editás el contenido y después:
```bash
./bin/repackage.sh naftometro-charts
```

### Subir una skill a Claude.ai (web)
Los `.skill` quedan en `dist/`. Subilos desde Settings → Skills en Claude.ai.

---

## 🧠 Cómo decidir qué guardás vs qué descargás

**Lo que tenés que portear entre máquinas:**

| Cosa | Por qué llevarla |
|---|---|
| `naftometro-skill-toolkit/` (este zip) | Es la fuente completa. Si la perdés, hay que regenerar todo |
| Carpeta `~/.claude/skills/` (instalada) | NO hace falta — el `setup.sh` la regenera desde el toolkit |

**Backup recomendado:** este toolkit en un repo Git (público o privado, ej: `naftometro-skills`). Cada vez que actualices una skill:
```bash
git add . && git commit -m "feat(conventions): agregar regla X" && git push
```

En la máquina nueva: `git clone` + `./setup.sh` y listo.

---

## ❓ FAQ

**¿Por qué `pyyaml` y no algo más liviano?**
Porque el script de validación de Anthropic lo usa. Es 1 dependencia, < 1MB instalada.

**¿Funciona si no tengo Claude Code, solo Claude.ai web?**
Sí. Saltate `setup.sh` (no instala nada útil sin Claude Code) y usá manualmente:
```bash
cd tools && python3 -m scripts.package_skill ../naftometro-conventions ../dist
```
Los `.skill` resultantes los subís a Claude.ai.

**¿Puedo modificar los scripts de `tools/scripts/`?**
Sí, son Apache 2.0. Pero te conviene mantenerlos como vienen para que sea fácil actualizarlos cuando Anthropic los mejore.

**Una skill no se está activando aunque parezca relevante.**
1. Verificar que está en `~/.claude/skills/<nombre>/SKILL.md`
2. Reiniciar Claude Code completamente
3. Si sigue sin triggear, el problema típico es la `description` — editala para incluir frases más explícitas sobre cuándo usarla. Las descriptions de este paquete ya están escritas con tono "pushy" para forzar el trigger.

**¿Cómo actualizo el toolkit (los scripts de `tools/`) cuando Anthropic los mejore?**
Reemplazá el contenido de `tools/scripts/` con la versión nueva. Las skills tuyas en las carpetas `naftometro-*/` no se tocan.

---

## 📜 Licencia

- Las skills (`naftometro-*/`) son tuyas, hacé lo que quieras.
- Los scripts en `tools/` son Apache 2.0 (de Anthropic). Ver `tools/LICENSE.txt`.
