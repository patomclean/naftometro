#!/usr/bin/env bash
# ============================================================
# Naftometro Skill Toolkit — Setup
# ============================================================
# Instala las skills de Naftometro en ~/.claude/skills/ y deja
# las herramientas listas para crear/actualizar skills.
#
# Uso: ./setup.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_SKILLS_DIR="${HOME}/.claude/skills"

echo "🔧 Naftometro Skill Toolkit — Setup"
echo "===================================="
echo

# 1. Verificar Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ python3 no está instalado. Instalalo primero (>=3.10)."
    echo "   macOS:   brew install python"
    echo "   Ubuntu:  sudo apt install python3 python3-pip"
    exit 1
fi
PY_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "✅ Python $PY_VERSION encontrado"

# 2. Instalar pyyaml (única dependencia)
echo
echo "📦 Instalando dependencias (pyyaml)..."
if python3 -m pip install --user -q -r "$SCRIPT_DIR/requirements.txt" 2>/dev/null; then
    echo "✅ Dependencias OK"
else
    echo "⚠️  Falló pip install --user. Probando con --break-system-packages..."
    python3 -m pip install --user --break-system-packages -q -r "$SCRIPT_DIR/requirements.txt"
    echo "✅ Dependencias OK"
fi

# 3. Instalar las skills en ~/.claude/skills/
echo
echo "📂 Instalando skills en $CLAUDE_SKILLS_DIR ..."
mkdir -p "$CLAUDE_SKILLS_DIR"

for skill in naftometro-conventions naftometro-ledger-rules naftometro-sql-migrations; do
    src="$SCRIPT_DIR/$skill"
    dst="$CLAUDE_SKILLS_DIR/$skill"
    if [ -d "$dst" ]; then
        echo "  ↻  $skill ya existe, sobreescribiendo..."
        rm -rf "$dst"
    fi
    cp -r "$src" "$dst"
    version=$(grep -A1 '^metadata:' "$dst/SKILL.md" | grep version | awk '{print $2}')
    echo "  ✅ $skill (v$version)"
done

echo
echo "============================================================"
echo "✅ Instalación completa"
echo "============================================================"
echo
echo "Las skills están en: $CLAUDE_SKILLS_DIR"
echo
echo "Para actualizar una skill después de editarla:"
echo "  ./bin/repackage.sh naftometro-conventions"
echo
echo "Para crear una skill nueva:"
echo "  ./bin/new-skill.sh nombre-de-la-skill"
echo
echo "Reiniciá Claude Code para que detecte las skills nuevas."
echo "============================================================"
