#!/usr/bin/env bash
# ============================================================
# Repackage: valida y empaqueta una skill como .skill (zip)
# ============================================================
# Uso: ./bin/repackage.sh <nombre-skill>
# Ejemplo: ./bin/repackage.sh naftometro-conventions
# ============================================================

set -e

if [ -z "$1" ]; then
    echo "Uso: ./bin/repackage.sh <nombre-skill>"
    echo "Ejemplo: ./bin/repackage.sh naftometro-conventions"
    exit 1
fi

SKILL_NAME="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_PATH="$SCRIPT_DIR/$SKILL_NAME"
DIST_DIR="$SCRIPT_DIR/dist"

if [ ! -d "$SKILL_PATH" ]; then
    echo "❌ No existe la carpeta: $SKILL_PATH"
    exit 1
fi

mkdir -p "$DIST_DIR"

cd "$SCRIPT_DIR/tools"
echo "🔍 Validando $SKILL_NAME ..."
python3 -m scripts.quick_validate "$SKILL_PATH"

echo
echo "📦 Empaquetando..."
python3 -m scripts.package_skill "$SKILL_PATH" "$DIST_DIR"

# Reinstalar en ~/.claude/skills/ automáticamente
CLAUDE_SKILLS_DIR="$HOME/.claude/skills"
if [ -d "$CLAUDE_SKILLS_DIR" ]; then
    echo
    echo "📂 Re-instalando en $CLAUDE_SKILLS_DIR ..."
    rm -rf "$CLAUDE_SKILLS_DIR/$SKILL_NAME"
    cp -r "$SKILL_PATH" "$CLAUDE_SKILLS_DIR/$SKILL_NAME"
    echo "✅ Skill actualizada en Claude Code (reiniciá Claude Code para detectarla)"
fi

echo
echo "✅ Listo. .skill generado en $DIST_DIR/$SKILL_NAME.skill"
