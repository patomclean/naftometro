#!/usr/bin/env bash
# ============================================================
# new-skill: scaffold para crear una skill nueva
# ============================================================
# Uso: ./bin/new-skill.sh <nombre-skill>
# Ejemplo: ./bin/new-skill.sh naftometro-charts
# ============================================================

set -e

if [ -z "$1" ]; then
    echo "Uso: ./bin/new-skill.sh <nombre-skill>"
    echo "Ejemplo: ./bin/new-skill.sh naftometro-charts"
    exit 1
fi

SKILL_NAME="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_PATH="$SCRIPT_DIR/$SKILL_NAME"

if [ -d "$SKILL_PATH" ]; then
    echo "❌ Ya existe: $SKILL_PATH"
    exit 1
fi

mkdir -p "$SKILL_PATH/references"
mkdir -p "$SKILL_PATH/assets"

# Crear SKILL.md template
cat > "$SKILL_PATH/SKILL.md" << EOF
---
name: $SKILL_NAME
description: TODO — Escribir una descripción detallada de cuándo se debe activar esta skill. Incluí frases concretas, contextos y términos del dominio para que Claude la trigger automáticamente. Ej "Use this skill whenever the user mentions X, Y, or Z; or when working on tasks involving A, B, C".
metadata:
  version: 0.1.0
---

# $SKILL_NAME

TODO: descripción corta de para qué sirve esta skill.

## Cuándo usarla

TODO

## Reglas / Convenciones

TODO

## Antipatrones

TODO

## Referencias adicionales

- \`references/...\` — TODO
EOF

# CHANGELOG inicial
cat > "$SKILL_PATH/CHANGELOG.md" << EOF
# $SKILL_NAME — Changelog

Formato: [SemVer](https://semver.org/lang/es/). Fecha: AAAA-MM-DD.

## [0.1.0] — $(date +%Y-%m-%d)

### Initial draft
- Estructura inicial creada con scaffold
EOF

echo "✅ Skill creada en: $SKILL_PATH"
echo
echo "Próximos pasos:"
echo "  1. Editar $SKILL_NAME/SKILL.md"
echo "  2. Validar:    cd tools && python3 -m scripts.quick_validate ../$SKILL_NAME"
echo "  3. Empaquetar: ./bin/repackage.sh $SKILL_NAME"
